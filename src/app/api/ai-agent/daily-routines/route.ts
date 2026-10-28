import { NextResponse } from "next/server";
import {
  executarRotinaDiariaRhema,
  isRhemaRoutinesEnabled,
  setRhemaRoutinesEnabled,
  type RotinaRhemaTipo,
} from "@/lib/ai/rhema-daily-routines";

export async function GET() {
  return NextResponse.json({
    sucesso: true,
    rotinasAtivas: isRhemaRoutinesEnabled(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.acao === "TOGGLE") {
      const novoStatus = setRhemaRoutinesEnabled(Boolean(body.ativas));
      return NextResponse.json({
        sucesso: true,
        rotinasAtivas: novoStatus,
        mensagem: novoStatus
          ? "Rotinas autônomas ativadas com sucesso."
          : "Rotinas autônomas pausadas em modo de segurança.",
      });
    }

    const rotina = (body.rotina || "BRIEFING_MATINAL_0730") as RotinaRhemaTipo;
    const sessionId = body.sessionId as string | undefined;
    const gestorPhone = body.gestorPhone as string | undefined;
    const dispararWhatsApp = Boolean(body.dispararWhatsApp);

    const resultado = await executarRotinaDiariaRhema({
      rotina,
      sessionId,
      gestorPhone,
      dispararWhatsApp,
    });

    return NextResponse.json({
      sucesso: true,
      ...resultado,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: err instanceof Error ? err.message : "Erro ao executar rotina diária do Rhema OS.",
      },
      { status: 500 }
    );
  }
}

