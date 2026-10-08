import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { processPersonalizedMessage, sanitizePhoneNumber } from "@/lib/spintax";
import type { AnyMessageContent } from "@whiskeysockets/baileys";
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

const broadcastBodySchema = z.object({
  recipients: z.array(recipientItemSchema).min(1, "Pelo menos um destinatário é necessário"),
  message: z.string().min(1, "Mensagem não pode ser vazia"),
  delay: z.number().optional(), // legacy delay ms
  minDelay: z.number().optional().default(2000), // ms (e.g. 2000 = 2s)
  maxDelay: z.number().optional().default(5000), // ms (e.g. 5000 = 5s, can be up to 60000ms)
  batchSize: z.number().optional().nullable(), // e.g. 20 msgs
  batchPause: z.number().optional().nullable(), // e.g. 180 seconds pause
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(), // 'image' | 'video' | 'document'
});

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
    } = parseResult.data;

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) {
      return NextResponse.json({ status: false, message: "Forbidden", error: "Forbidden" }, { status: 403 });
    }

    const instance = waManager.getInstance(sessionId);
    if (!instance?.socket) {
      return NextResponse.json({ status: false, message: "Sessão do WhatsApp desconectada ou não pronta", error: "Session not ready" }, { status: 503 });
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

      // If item is already a full JID (e.g. 551199999999@s.whatsapp.net or group @g.us)
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
      return NextResponse.json({ status: false, message: "Nenhum destinatário válido encontrado", error: "No valid recipients" }, { status: 400 });
    }

    const minDelay = Math.max(1000, reqMinDelay || delay || 2000);
    const maxDelay = Math.max(minDelay, reqMaxDelay || delay || 5000);

    // Create BroadcastLog in DB
    const log = await prisma.broadcastLog.create({
      data: {
        sessionId,
        message,
        total: normalizedRecipients.length,
        delay: minDelay,
        minDelay,
        maxDelay,
        batchSize: batchSize || null,
        batchPause: batchPause || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        status: "running",
        recipients: {
          create: normalizedRecipients.map((r) => ({
            jid: r.jid,
            name: r.name || null,
            variables: r.variables ? JSON.parse(JSON.stringify(r.variables)) : null,
            status: "pending",
          })),
        },
      },
    });

    const broadcastId = log.id;
    const io = (global as any).io;

    // Initial socket event
    if (io) {
      io.to(sessionId).emit("broadcast.progress", {
        broadcastId,
        status: "running",
        total: normalizedRecipients.length,
        sent: 0,
        failed: 0,
        current: null,
        progress: 0,
        startedAt: log.startedAt.toISOString(),
      });
    }

    // Run processing loop in background
    (async () => {
      let sent = 0;
      let failed = 0;
      const errors: { jid: string; error: string }[] = [];

      for (let i = 0; i < normalizedRecipients.length; i++) {
        // 1. Check if broadcast status was changed (paused or cancelled)
        let checkLog = await prisma.broadcastLog.findUnique({
          where: { id: broadcastId },
          select: { status: true },
        });

        if (checkLog?.status === "cancelled") {
          console.log(`[Broadcast ${broadcastId}] Cancelled by user.`);
          break;
        }

        // Handle paused state (wait until resumed or cancelled)
        while (checkLog?.status === "paused") {
          await new Promise((r) => setTimeout(r, 2000));
          checkLog = await prisma.broadcastLog.findUnique({
            where: { id: broadcastId },
            select: { status: true },
          });
          if (checkLog?.status === "cancelled") break;
        }

        if (checkLog?.status === "cancelled") break;

        const recipient = normalizedRecipients[i];
        let personalizedText = "";

        try {
          // 2. Resolve Spintax and Variables dynamically per recipient
          const allVars = {
            ...(recipient.variables || {}),
            nome: recipient.name || (recipient.variables as any)?.nome || "",
            telefone: recipient.phone,
          };

          personalizedText = processPersonalizedMessage(message, allVars);

          // 3. Construct message payload
          let messageContent: AnyMessageContent;
          if (mediaUrl) {
            if (mediaType === "document") {
              messageContent = {
                document: { url: mediaUrl },
                caption: personalizedText,
                mimetype: "application/pdf",
                fileName: "documento.pdf",
              };
            } else if (mediaType === "video") {
              messageContent = {
                video: { url: mediaUrl },
                caption: personalizedText,
              };
            } else {
              messageContent = {
                image: { url: mediaUrl },
                caption: personalizedText,
              };
            }
          } else {
            messageContent = { text: personalizedText };
          }

          // 4. Send message through Baileys
          await instance.socket!.sendMessage(recipient.jid, messageContent);
          sent++;

          // 5. Update DB recipient with resolved personalized text
          await prisma.broadcastRecipient.updateMany({
            where: { broadcastLogId: broadcastId, jid: recipient.jid },
            data: {
              status: "sent",
              sentAt: new Date(),
              resolvedMessage: personalizedText,
            },
          });
        } catch (e: any) {
          failed++;
          const errorMsg = e?.message || "Unknown error";
          errors.push({ jid: recipient.jid, error: errorMsg });
          console.error(`Failed to send broadcast to ${recipient.jid}:`, e);

          await prisma.broadcastRecipient.updateMany({
            where: { broadcastLogId: broadcastId, jid: recipient.jid },
            data: {
              status: "failed",
              error: errorMsg,
              resolvedMessage: personalizedText || null,
            },
          });
        }

        const progress = Math.round(((sent + failed) / normalizedRecipients.length) * 100);

        // Update progress in BroadcastLog
        await prisma.broadcastLog.update({
          where: { id: broadcastId },
          data: { sent, failed },
        });

        // Socket real-time progress update
        if (io) {
          io.to(sessionId).emit("broadcast.progress", {
            broadcastId,
            status: "running",
            total: normalizedRecipients.length,
            sent,
            failed,
            current: recipient.jid,
            currentName: recipient.name || null,
            currentMessage: personalizedText,
            progress,
          });
        }

        // 6. Delay handling between messages
        if (i < normalizedRecipients.length - 1) {
          // Check if batch pause should trigger
          if (batchSize && batchPause && (i + 1) % batchSize === 0) {
            const pauseSeconds = batchPause;
            console.log(`[Broadcast ${broadcastId}] Pausa de segurança em lote por ${pauseSeconds}s...`);

            if (io) {
              io.to(sessionId).emit("broadcast.batch_pause", {
                broadcastId,
                pauseSeconds,
                completedBatch: i + 1,
              });
            }

            await new Promise((r) => setTimeout(r, pauseSeconds * 1000));
          } else {
            // Random delay between minDelay and maxDelay
            const randomDelay =
              minDelay >= maxDelay
                ? minDelay
                : Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

            await new Promise((r) => setTimeout(r, randomDelay));
          }
        }
      }

      // Mark final completion in DB
      const finalLog = await prisma.broadcastLog.findUnique({
        where: { id: broadcastId },
        select: { status: true },
      });

      const finalStatus = finalLog?.status === "cancelled" ? "cancelled" : "completed";

      await prisma.broadcastLog.update({
        where: { id: broadcastId },
        data: { status: finalStatus, sent, failed, completedAt: new Date() },
      });

      if (io) {
        io.to(sessionId).emit("broadcast.progress", {
          broadcastId,
          status: finalStatus,
          total: normalizedRecipients.length,
          sent,
          failed,
          errors,
          progress: 100,
          completedAt: new Date().toISOString(),
        });
      }

      console.log(`[Broadcast ${broadcastId}] Finalizado (${finalStatus}): ${sent} enviados, ${failed} falhas.`);
    })();

    return NextResponse.json({
      status: true,
      message: "Disparo iniciado com sucesso em segundo plano",
      data: { broadcastId: log.id, total: normalizedRecipients.length },
    });
  } catch (e: any) {
    console.error("Broadcast error", e);
    return NextResponse.json(
      { status: false, message: "Falha ao iniciar disparo", error: e.message },
      { status: 500 }
    );
  }
}
