import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { WhatsAppManager } from "@/modules/whatsapp/manager";
import { z } from "zod";

const sendRadarSchema = z.object({
  sessionId: z.string().optional(),
  telefone: z.string().min(8, "Telefone do corretor é obrigatório"),
  corretorNome: z.string().optional(),
  mensagem: z.string().min(5, "Mensagem é obrigatória"),
  tipo: z.enum(["radar", "cadence", "custom"]).default("radar"),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canAccess = isAdmin(user.role) || (await canUser(user.id, "management.broker_support_radar"));
    if (!canAccess) {
      return NextResponse.json(
        { status: false, message: "Acesso restrito ao perfil de gestão comercial." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = sendRadarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Dados inválidos", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { telefone, mensagem, tipo } = parsed.data;

    // 1. Identificar a sessão WhatsApp de envio (Padrão: Brunno)
    let targetSessionId = parsed.data.sessionId?.trim();

    if (!targetSessionId) {
      // Procura primeiro sessão associada a Brunno
      const brunnoSession = await prisma.session.findFirst({
        where: {
          OR: [
            { name: { contains: "Brunno" } },
            { user: { name: { contains: "Brunno" } } },
            { user: { email: { contains: "brunno" } } },
          ],
          status: "CONNECTED",
        },
      });

      if (brunnoSession) {
        targetSessionId = brunnoSession.sessionId;
      } else {
        // Fallback: primeira sessão conectada do usuário logado ou do sistema
        const connectedSession = await prisma.session.findFirst({
          where: { status: "CONNECTED" },
          orderBy: { updatedAt: "desc" },
        });

        if (connectedSession) {
          targetSessionId = connectedSession.sessionId;
        } else {
          // Fallback qualquer sessão
          const anySession = await prisma.session.findFirst();
          if (!anySession) {
            return NextResponse.json(
              { status: false, message: "Nenhuma sessão do WhatsApp configurada na plataforma." },
              { status: 400 }
            );
          }
          targetSessionId = anySession.sessionId;
        }
      }
    }

    // 2. Validar se a sessão está online no Baileys
    const manager = WhatsAppManager.getInstance();
    const instance = manager.getInstance(targetSessionId);
    if (!instance || !instance.socket) {
      return NextResponse.json(
        {
          status: false,
          message: `A sessão WhatsApp selecionada (${targetSessionId}) está desconectada. Conecte o QR Code antes de disparar.`,
        },
        { status: 400 }
      );
    }

    // 3. Normalizar o telefone de destino para o JID do WhatsApp
    let cleanPhone = telefone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = `55${cleanPhone}`;
    }
    const destinationJid = `${cleanPhone}@s.whatsapp.net`;

    // 4. Enviar mensagem via ChatService
    const result: any = await ChatService.sendTextMessage(
      targetSessionId,
      destinationJid,
      { text: mensagem }
    );

    return NextResponse.json({
      status: true,
      message: `Mensagem de ${tipo} enviada com sucesso para o corretor!`,
      data: {
        destinationJid,
        sessionId: targetSessionId,
        messageId: result?.key?.id || null,
      },
    });
  } catch (error: any) {
    console.error("Erro no envio do radar:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao enviar mensagem para o corretor", error: error.message },
      { status: 500 }
    );
  }
}
