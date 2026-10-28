import { NextResponse } from "next/server";
import { executarRotinaDiariaRhema, type RotinaRhemaTipo } from "@/lib/ai/rhema-daily-routines";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
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

