import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, canUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const isSuperadmin = user.role === "SUPERADMIN";
    const canAudit = isSuperadmin || (await canUser(user.id, "chat.superadmin_audit" as any));

    if (!canAudit) {
      return NextResponse.json(
        { status: false, message: "Acesso restrito ao Superadmin.", error: "Forbidden" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jid = searchParams.get("jid");

    if (!jid) {
      return NextResponse.json(
        { status: false, message: "Parâmetro jid é obrigatório." },
        { status: 400 }
      );
    }

    // PRIVACY & AUDIT CHECK: Ensure this contact originated from a broadcast campaign
    const isCampaignLead = await prisma.broadcastRecipient.findFirst({
      where: {
        jid,
        status: { in: ["sent", "responded", "pending"] },
      },
      include: {
        broadcastLog: {
          select: { name: true, templateName: true, startedAt: true },
        },
      },
    });

    if (!isCampaignLead) {
      return NextResponse.json(
        {
          status: false,
          message: "Este contato não se originou de uma campanha da ferramenta. Conversas particulares ou sem vínculo inicial de disparo não são auditáveis para proteção da privacidade.",
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    // Fetch all messages for this remoteJid across all sessions (permanent historical archive)
    const messages = await prisma.message.findMany({
      where: {
        remoteJid: jid,
      },
      orderBy: { timestamp: "asc" },
      take: 200,
    });

    const serializedMessages = messages.map((m) => ({
      id: m.id,
      keyId: m.keyId,
      content: m.content,
      fromMe: m.fromMe,
      timestamp: m.timestamp.toISOString(),
      type: m.type,
      status: m.status,
      pushName: m.pushName,
      mediaUrl: m.mediaUrl,
      remoteJid: m.remoteJid,
    }));

    return NextResponse.json({
      status: true,
      leadInfo: {
        name: isCampaignLead.name,
        campaignName: isCampaignLead.broadcastLog?.name || "Disparo Inicial",
        templateName: isCampaignLead.broadcastLog?.templateName,
        corretor: isCampaignLead.imoviewCorretor || "Rhema Imóveis",
        sentAt: isCampaignLead.sentAt?.toISOString(),
      },
      data: serializedMessages,
    });
  } catch (error: any) {
    console.error("Superadmin Lead Messages error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar histórico de mensagens do lead", error: error.message },
      { status: 500 }
    );
  }
}
