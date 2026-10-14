import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiAgentConfig } from "@/lib/ai/agent-service";

export async function GET() {
  try {
    const config = await getAiAgentConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar configurações" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const updated = await prisma.aiAgentConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        enabled: Boolean(body.enabled),
        apiKey: body.apiKey?.trim() || "",
        model: body.model || "nvidia/nemotron-3.5-lightning:free",
        fallbackModel: body.fallbackModel || "nvidia/nemotron-3-super-120b-a12b:free",
        receptionPhone: body.receptionPhone?.trim() || null,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.3,
        systemPrompt: body.systemPrompt?.trim() || null,
        notifyReceptionOnUpdate: body.notifyReceptionOnUpdate ?? true,
        autoRecordImoviewHistory: body.autoRecordImoviewHistory ?? true,
        simulateTypingDelay: body.simulateTypingDelay ?? true,
        minTypingSeconds: body.minTypingSeconds || 3,
        maxTypingSeconds: body.maxTypingSeconds || 6,
      },
      update: {
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
        apiKey: body.apiKey !== undefined ? body.apiKey.trim() : undefined,
        model: body.model || undefined,
        fallbackModel: body.fallbackModel || undefined,
        receptionPhone: body.receptionPhone !== undefined ? body.receptionPhone.trim() : undefined,
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        systemPrompt: body.systemPrompt !== undefined ? body.systemPrompt.trim() : undefined,
        notifyReceptionOnUpdate: body.notifyReceptionOnUpdate !== undefined ? Boolean(body.notifyReceptionOnUpdate) : undefined,
        autoRecordImoviewHistory: body.autoRecordImoviewHistory !== undefined ? Boolean(body.autoRecordImoviewHistory) : undefined,
        simulateTypingDelay: body.simulateTypingDelay !== undefined ? Boolean(body.simulateTypingDelay) : undefined,
        minTypingSeconds: body.minTypingSeconds !== undefined ? Number(body.minTypingSeconds) : undefined,
        maxTypingSeconds: body.maxTypingSeconds !== undefined ? Number(body.maxTypingSeconds) : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao salvar configurações" },
      { status: 500 }
    );
  }
}
