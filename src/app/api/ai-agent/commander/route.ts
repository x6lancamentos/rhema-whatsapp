import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  executeCommanderCommand,
  executeBrokerSelfServiceCommand,
  getCommanderPhones,
  setCommanderPhones,
  listarLearnCards,
  type RhemaAccessRole,
} from "@/lib/ai/rhema-commander-service";

export async function GET() {
  try {
    const [brokers, sessions] = await Promise.all([
      prisma.brokerContact.findMany({
        orderBy: { nome: "asc" },
      }),
      prisma.session.findMany({
        select: { sessionId: true, status: true },
      }),
    ]);

    return NextResponse.json({
      sucesso: true,
      commanderPhones: getCommanderPhones(),
      learnCards: listarLearnCards(),
      brokers,
      sessions,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: err instanceof Error ? err.message : "Erro ao carregar status do Rhema OS Commander.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const acao = String(body.acao || "COMANDO");

    if (acao === "ATUALIZAR_PHONES") {
      const phones = Array.isArray(body.phones)
        ? body.phones
        : String(body.phones || "")
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
      const atualizados = setCommanderPhones(phones);
      return NextResponse.json({
        sucesso: true,
        commanderPhones: atualizados,
      });
    }

    const comandoTexto = String(body.comandoTexto || "DIAGNÓSTICO GERAL");
    const roleSimulado = (body.roleSimulado || "COMMANDER_GESTOR") as RhemaAccessRole;
    const remetenteNome = String(body.remetenteNome || "Brunno Anastácio");

    if (roleSimulado === "BROKER_CORRETOR" && /^#(meuplacar|meusleads)/i.test(comandoTexto.trim())) {
      const selfRes = await executeBrokerSelfServiceCommand({
        corretorNome: remetenteNome,
        comandoTexto,
      });
      return NextResponse.json({
        sucesso: true,
        permitido: true,
        comandoIdentificado: "BROKER_SELF_SERVICE",
        respostaWhatsApp: selfRes.respostaWhatsApp,
        learnCards: listarLearnCards(),
      });
    }

    const resultado = await executeCommanderCommand({
      comandoTexto,
      role: roleSimulado,
      remetenteNome,
    });

    return NextResponse.json({
      sucesso: true,
      ...resultado,
      learnCards: listarLearnCards(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: err instanceof Error ? err.message : "Erro ao executar comando no Rhema OS.",
      },
      { status: 500 }
    );
  }
}

