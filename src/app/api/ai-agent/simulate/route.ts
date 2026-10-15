import { NextRequest, NextResponse } from "next/server";
import { processOwnerMessage } from "@/lib/ai/agent-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.messageText || body.messageText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "A mensagem do proprietário não pode ser vazia." },
        { status: 400 }
      );
    }

    const result = await processOwnerMessage({
      jid: body.jid || `55${(body.phone || "13999998888").replace(/\D/g, "")}@s.whatsapp.net`,
      phone: body.phone || "13999998888",
      contactName: body.contactName || "Proprietário de Teste",
      codigoImovelOverride: body.codigoImovel || "4820",
      messageText: body.messageText.trim(),
      simulateOnly: true, // Garante que é ambiente seguro de simulação sem disparar WhatsApp real
      historyOverride: Array.isArray(body.history) ? body.history : undefined,
      rollingSummaryOverride: typeof body.rollingSummary === "string" ? body.rollingSummary : undefined,
      collectedDataOverride: body.collectedData && typeof body.collectedData === "object" ? body.collectedData : undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro durante a simulação do agente." },
      { status: 500 }
    );
  }
}
