import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWhatsAppSocket } from "@/lib/hunter/hunter-orchestrator";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const opportunityId = searchParams.get("opportunityId");

    if (!opportunityId) {
      return NextResponse.json({ success: false, error: "ID da oportunidade obrigatório" }, { status: 400 });
    }

    const opportunity = await prisma.hunterOpportunity.findUnique({
      where: { id: opportunityId },
      include: {
        cadenceLogs: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ success: false, error: "Oportunidade não encontrada" }, { status: 404 });
    }

    // Busca também mensagens nativas do WhatsApp se houver registros na tabela Message
    const cleanPhone = (opportunity.proprietarioTelefone || "").replace(/\D/g, "");
    let whatsappMessages: any[] = [];
    try {
      if (cleanPhone.length >= 8) {
        whatsappMessages = await prisma.message.findMany({
          where: {
            OR: [
              { remoteJid: opportunity.proprietarioJid },
              { remoteJid: { contains: cleanPhone.slice(-8) } },
            ],
          },
          orderBy: { timestamp: "asc" },
          take: 50,
        });
      }
    } catch {
      // Ignora se a tabela Message não possuir os campos esperados
    }

    return NextResponse.json({
      success: true,
      opportunity,
      logs: opportunity.cadenceLogs || [],
      whatsappMessages,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { opportunityId, text } = body;

    if (!opportunityId || !text?.trim()) {
      return NextResponse.json(
        { success: false, error: "ID da oportunidade e texto da mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    const opportunity = await prisma.hunterOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return NextResponse.json({ success: false, error: "Oportunidade não encontrada" }, { status: 404 });
    }

    // Tenta enviar via WhatsApp Socket ativo
    const sock = getActiveWhatsAppSocket();
    let sentViaSocket = false;
    if (sock && opportunity.proprietarioJid) {
      try {
        await sock.sendMessage(opportunity.proprietarioJid, { text: text.trim() });
        sentViaSocket = true;
      } catch (err: any) {
        console.warn("[HunterMessages] Aviso ao enviar WhatsApp via socket:", err.message);
      }
    }

    // Registra no HunterCadenceLog
    const cadenceLog = await prisma.hunterCadenceLog.create({
      data: {
        opportunityId: opportunity.id,
        direcao: "OUT",
        tipo: "MANUAL_REPLY",
        conteudo: text.trim(),
        analiseCoach: {
          modo: "MANUAL_CORRETOR",
          enviadoViaWhatsApp: sentViaSocket,
        },
      },
    });

    // Se o status era DISCOVERED ou QUEUED, move para APPROACHING
    if (opportunity.status === "DISCOVERED" || opportunity.status === "QUEUED") {
      await prisma.hunterOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "APPROACHING" },
      });
    }

    return NextResponse.json({
      success: true,
      message: sentViaSocket
        ? "Mensagem enviada no WhatsApp com sucesso!"
        : "Mensagem registrada no histórico da oportunidade!",
      log: cadenceLog,
      sentViaSocket,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

