import { NextRequest, NextResponse } from "next/server";
import { testOpenRouterConnection } from "@/lib/ai/openrouter-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey?.trim();
    const model = body.model?.trim() || "nvidia/nemotron-3.5-lightning:free";

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Chave do OpenRouter não informada." },
        { status: 400 }
      );
    }

    const result = await testOpenRouterConnection(apiKey, model);

    return NextResponse.json({
      success: true,
      message: "Conexão com OpenRouter e NVIDIA estabelecida com sucesso!",
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
      usage: result.usage,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao conectar com OpenRouter.",
      },
      { status: 500 }
    );
  }
}
