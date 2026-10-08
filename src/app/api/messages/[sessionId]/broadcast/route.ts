import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { sanitizePhoneNumber } from "@/lib/spintax";
import { executeBroadcast } from "@/lib/broadcast-engine";
import { z } from "zod";

const recipientItemSchema = z.union([
  z.string(),
  z.object({
    jid: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional().nullable(),
    variables: z.record(z.string(), z.any()).optional().nullable(),
  }),
]);

const broadcastBodySchema = z
  .object({
    recipients: z.array(recipientItemSchema).min(1, "Pelo menos um destinatário é necessário"),
    message: z.string().optional().default(""),
    delay: z.number().optional(), // legacy delay ms
    minDelay: z.number().optional().default(2000), // ms (e.g. 2000 = 2s)
    maxDelay: z.number().optional().default(5000), // ms (e.g. 5000 = 5s)
    batchSize: z.number().optional().nullable(), // e.g. 20 msgs
    batchPause: z.number().optional().nullable(), // e.g. 180 seconds pause
    mediaUrl: z.string().optional().nullable(),
    mediaType: z.string().optional().nullable(), // 'image' | 'video' | 'document'
    audioUrl: z.string().optional().nullable(),
    isPtt: z.boolean().optional().default(false), // Native voice note
    sessionIds: z.array(z.string()).optional().nullable(), // Multi-chip sessions
    scheduledAt: z.string().optional().nullable(), // ISO string
    simulateTyping: z.boolean().optional().default(true),
    businessHoursOnly: z.boolean().optional().default(false),
    startHour: z.number().optional().default(8),
    endHour: z.number().optional().default(20),
  })
  .refine(
    (data) =>
      (data.message && data.message.trim().length > 0) ||
      !!data.mediaUrl ||
      !!data.audioUrl,
    {
      message: "Mensagem de texto, mídia ou áudio é obrigatório",
      path: ["message"],
    }
  );

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.json();

    const parseResult = broadcastBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ status: false, error: parseResult.error.flatten() }, { status: 400 });
    }

    const {
      recipients: rawRecipients,
      message,
      delay,
      minDelay: reqMinDelay,
      maxDelay: reqMaxDelay,
      batchSize,
      batchPause,
      mediaUrl,
      mediaType,
      audioUrl,
      isPtt,
      sessionIds,
      scheduledAt,
      simulateTyping,
      businessHoursOnly,
      startHour,
      endHour,
    } = parseResult.data;

    // Check primary session access
    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) {
      return NextResponse.json({ status: false, message: "Forbidden", error: "Forbidden" }, { status: 403 });
    }

    // Check all multi-chip sessions if specified
    const allSelectedSessions = sessionIds && sessionIds.length > 0 ? sessionIds : [sessionId];
    for (const sId of allSelectedSessions) {
      const allowed = await canAccessSession(user.id, user.role, sId);
      if (!allowed) {
        return NextResponse.json(
          { status: false, message: `Sem acesso à sessão ${sId}`, error: "Forbidden session" },
          { status: 403 }
        );
      }
    }

    // Verify that at least one selected session is connected
    const anyConnected = allSelectedSessions.some((sId) => {
      const inst = waManager.getInstance(sId);
      return !!inst?.socket;
    });

    if (!anyConnected) {
      return NextResponse.json(
        {
          status: false,
          message: "Nenhuma das sessões selecionadas está conectada no momento",
          error: "No connected sessions",
        },
        { status: 503 }
      );
    }

    // Normalize recipients list
    interface NormalizedRecipient {
      jid: string;
      phone: string;
      name?: string;
      variables?: Record<string, any>;
    }

    const normalizedRecipients: NormalizedRecipient[] = [];
    const seenJids = new Set<string>();

    for (const item of rawRecipients) {
      let rawPhone = "";
      let name = "";
      let variables: Record<string, any> = {};

      if (typeof item === "string") {
        rawPhone = item;
      } else {
        rawPhone = item.phone || item.jid || "";
        name = item.name || "";
        variables = item.variables || {};
      }

      let jid = "";
      let phone = "";

      if (rawPhone.includes("@")) {
        jid = rawPhone;
        phone = rawPhone.split("@")[0];
      } else {
        const sanitized = sanitizePhoneNumber(rawPhone);
        if (!sanitized.isValid) continue;
        jid = sanitized.jid;
        phone = sanitized.phone;
      }

      if (!seenJids.has(jid)) {
        seenJids.add(jid);
        normalizedRecipients.push({ jid, phone, name, variables });
      }
    }

    if (normalizedRecipients.length === 0) {
      return NextResponse.json(
        { status: false, message: "Nenhum destinatário válido encontrado", error: "No valid recipients" },
        { status: 400 }
      );
    }

    // Filter against Blacklist (Opt-out)
    const blacklisted = await prisma.blacklist.findMany({
      where: { userId: user.id },
      select: { phone: true, jid: true },
    });
    const blacklistedPhones = new Set(blacklisted.map((b) => b.phone));
    const blacklistedJids = new Set(blacklisted.map((b) => b.jid));

    let blacklistedCount = 0;
    const filteredRecipients = normalizedRecipients.filter((r) => {
      const isBlocked = blacklistedPhones.has(r.phone) || blacklistedJids.has(r.jid);
      if (isBlocked) blacklistedCount++;
      return !isBlocked;
    });

    if (filteredRecipients.length === 0) {
      return NextResponse.json(
        {
          status: false,
          message: `Todos os ${blacklistedCount} contatos selecionados estão na Lista Negra (Opt-Out). Disparo não iniciado.`,
          error: "All contacts blacklisted",
        },
        { status: 400 }
      );
    }

    const minDelay = Math.max(1000, reqMinDelay || delay || 2000);
    const maxDelay = Math.max(minDelay, reqMaxDelay || delay || 5000);

    const isScheduled = !!scheduledAt && new Date(scheduledAt) > new Date();
    const scheduledDate = isScheduled ? new Date(scheduledAt!) : null;

    // Create BroadcastLog in DB
    const log = await prisma.broadcastLog.create({
      data: {
        sessionId,
        message: message || "",
        total: filteredRecipients.length,
        delay: minDelay,
        minDelay,
        maxDelay,
        batchSize: batchSize || null,
        batchPause: batchPause || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        audioUrl: audioUrl || null,
        isPtt: !!isPtt,
        sessionIds: allSelectedSessions,
        scheduledAt: scheduledDate,
        simulateTyping,
        businessHoursOnly,
        startHour,
        endHour,
        status: isScheduled ? "scheduled" : "running",
        recipients: {
          create: filteredRecipients.map((r) => ({
            jid: r.jid,
            name: r.name || null,
            variables: r.variables ? JSON.parse(JSON.stringify(r.variables)) : null,
            status: "pending",
          })),
        },
      },
    });

    // Start background execution if not scheduled
    if (!isScheduled) {
      executeBroadcast(log.id).catch((err) =>
        console.error(`[Broadcast] Execution error for ${log.id}:`, err)
      );
    }

    return NextResponse.json({
      status: true,
      message: isScheduled
        ? `Disparo agendado com sucesso para ${scheduledDate?.toLocaleString("pt-BR")}`
        : "Disparo iniciado com sucesso em segundo plano",
      data: {
        broadcastId: log.id,
        total: filteredRecipients.length,
        filteredBlacklist: blacklistedCount,
        status: log.status,
        scheduledAt: log.scheduledAt,
      },
    });
  } catch (e: any) {
    console.error("Broadcast error", e);
    return NextResponse.json(
      { status: false, message: "Falha ao iniciar disparo", error: e.message },
      { status: 500 }
    );
  }
}
