import { NextResponse } from "next/server";
import { processRhemaVoiceOrText } from "@/lib/ai/rhema-voice-copilot";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      remetenteNome = "Corretor Rhema",
      isGestor = false,
      texto,
      audioBase64,
      audioMimeType,
      openRouterApiKey,
      groqApiKey,
    } = body;

    const resultado = await processRhemaVoiceOrText({
      remetenteNome,
      isGestor,
      texto,
      audioBase64,
      audioMimeType,
      openRouterApiKey,
      groqApiKey,
    });

    return NextResponse.json({
      sucesso: true,
      ...resultado,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar áudio/comando Rhema.";
    return NextResponse.json(
      {
        sucesso: false,
        erro: message,
      },
      { status: 400 }
    );
  }
}

