import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, canUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { formatPhone } from "@/lib/phone-formatter";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    // Strict Permission: Superadmin or user with specific audit permission
    const isSuperadmin = user.role === "SUPERADMIN";
    const canAudit = isSuperadmin || (await canUser(user.id, "chat.superadmin_audit" as any));

    if (!canAudit) {
      return NextResponse.json(
        {
          status: false,
          message: "Acesso restrito ao Superadmin para supervisão e auditoria de qualidade de atendimento.",
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const corretor = searchParams.get("corretor") || undefined;
    const limit = parseInt(searchParams.get("limit") || "60", 10);

    // Fetch all recipients that were touched by broadcasts (status = sent or responded)
    const recipients = await prisma.broadcastRecipient.findMany({
      where: {
        status: { in: ["sent", "responded"] },
        ...(corretor ? { imoviewCorretor: corretor } : {}),
      },
      include: {
        broadcastLog: {
          select: {
            id: true,
            name: true,
            startedAt: true,
            sessionId: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 200,
    });

    if (recipients.length === 0) {
      return NextResponse.json({
        status: true,
        data: [],
        message: "Nenhum lead de campanha encontrado até o momento.",
      });
    }

    // Group by unique JID to present 1 conversational thread per lead
    const uniqueLeadsMap = new Map<string, {
      jid: string;
      name: string;
      phone: string;
      campaignName: string;
      campaignId: string;
      corretorNome: string;
      sentAt: string;
      responded: boolean;
      sessionIdUsed: string | null;
      lastMessage?: {
        content: string | null;
        timestamp: string;
        fromMe: boolean;
        type: string;
      };
    }>();

    for (const r of recipients) {
      if (uniqueLeadsMap.has(r.jid)) continue;

      const phone = r.jid.split("@")[0];
      const displayName = r.name || formatPhone(r.jid);
      const corretor = r.imoviewCorretor || "Rhema Imóveis";

      uniqueLeadsMap.set(r.jid, {
        jid: r.jid,
        name: displayName,
        phone,
        campaignName: r.broadcastLog?.name || "Disparo Rhema",
        campaignId: r.broadcastLog?.id || "",
        corretorNome: corretor,
        sentAt: r.sentAt ? r.sentAt.toISOString() : new Date().toISOString(),
        responded: r.status === "responded",
        sessionIdUsed: r.sessionIdUsed || r.broadcastLog?.sessionId || null,
      });
    }

    const leadList = Array.from(uniqueLeadsMap.values());
    const leadJids = leadList.map((l) => l.jid);

    // Fetch last message for each JID across all messages in database
    const lastMessages = await prisma.message.findMany({
      where: {
        remoteJid: { in: leadJids },
      },
      orderBy: { timestamp: "desc" },
      take: 500,
    });

    const lastMsgMap = new Map<string, {
      content: string | null;
      timestamp: string;
      fromMe: boolean;
      type: string;
    }>();

    for (const m of lastMessages) {
      if (!lastMsgMap.has(m.remoteJid)) {
        lastMsgMap.set(m.remoteJid, {
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          fromMe: m.fromMe,
          type: m.type,
        });
      }
    }

    // Attach last message and sort by most recent activity
    leadList.forEach((lead) => {
      lead.lastMessage = lastMsgMap.get(lead.jid);
    });

    leadList.sort((a, b) => {
      const tsA = a.lastMessage?.timestamp || a.sentAt;
      const tsB = b.lastMessage?.timestamp || b.sentAt;
      return new Date(tsB).getTime() - new Date(tsA).getTime();
    });

    // Apply search filter if provided
    let filtered = leadList;
    if (search) {
      filtered = leadList.filter(
        (l) =>
          l.name.toLowerCase().includes(search) ||
          l.phone.includes(search) ||
          l.campaignName.toLowerCase().includes(search) ||
          l.corretorNome.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      status: true,
      data: filtered.slice(0, limit),
      total: filtered.length,
    });
  } catch (error: any) {
    console.error("Superadmin Campaign Leads error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar leads de campanha para auditoria", error: error.message },
      { status: 500 }
    );
  }
}
