import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getImoviewConfig, testImoviewConnection } from "@/lib/imoview";
import { z } from "zod";

const configSchema = z.object({
  apiKey: z.string().min(1, "Chave de API do Imoview é obrigatória"),
  baseUrl: z.string().optional().default("https://api.imoview.com.br"),
  isActive: z.boolean().optional().default(true),
  autoRecordInteraction: z.boolean().optional().default(true),
  autoRecordResponse: z.boolean().optional().default(true),
  autoNotifyBroker: z.boolean().optional().default(true),
});

// GET: Return current Imoview integration config
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const config = await getImoviewConfig();

    // Mask API key for security
    const maskedKey = config.apiKey
      ? config.apiKey.length > 8
        ? `${config.apiKey.slice(0, 4)}••••••••${config.apiKey.slice(-4)}`
        : "••••••••"
      : "";

    return NextResponse.json({
      status: true,
      data: {
        hasKey: !!config.apiKey,
        maskedKey,
        baseUrl: config.baseUrl,
        isActive: config.isActive,
        autoRecordInteraction: config.autoRecordInteraction,
        autoRecordResponse: config.autoRecordResponse,
        autoNotifyBroker: config.autoNotifyBroker,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Failed to fetch Imoview config", error: error.message },
      { status: 500 }
    );
  }
}

// POST: Save and validate Imoview integration config
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Dados inválidos", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { apiKey, baseUrl, isActive, autoRecordInteraction, autoRecordResponse, autoNotifyBroker } = parsed.data;

    // Test connection with Imoview
    const testResult = await testImoviewConnection(apiKey, baseUrl);

    // Save to database
    const saved = await prisma.imoviewConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        isActive,
        autoRecordInteraction,
        autoRecordResponse,
        autoNotifyBroker,
      },
      update: {
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        isActive,
        autoRecordInteraction,
        autoRecordResponse,
        autoNotifyBroker,
      },
    });

    return NextResponse.json({
      status: true,
      message: testResult.success
        ? "Configurações salvas e conexão com o Imoview validada com sucesso!"
        : "Configurações salvas. Nota: a validação automática não conseguiu resposta da API do Imoview, verifique se a chave está correta.",
      testResult,
      data: {
        hasKey: !!saved.apiKey,
        baseUrl: saved.baseUrl,
        isActive: saved.isActive,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Failed to save Imoview config", error: error.message },
      { status: 500 }
    );
  }
}
