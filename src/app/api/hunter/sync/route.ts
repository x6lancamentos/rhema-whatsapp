import { NextResponse } from "next/server";
import { collectEemovelOpportunities } from "@/lib/hunter/eemovel-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bairros, valorMin, valorMax, limite } = body;

    // Se parâmetros foram passados, salva no config default
    if (bairros || valorMin || valorMax || limite) {
      await prisma.hunterConfig.upsert({
        where: { id: "default" },
        update: {
          bairrosSantos: bairros ? (Array.isArray(bairros) ? bairros : [bairros]) : undefined,
          valorMin: valorMin ? Number(valorMin) : undefined,
          valorMax: valorMax ? Number(valorMax) : undefined,
          limiteDiario: limite ? Number(limite) : undefined,
        },
        create: {
          id: "default",
          bairrosSantos: bairros ? (Array.isArray(bairros) ? bairros : [bairros]) : ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida"],
          tiposImovel: ["Apartamento", "Casa", "Cobertura"],
          valorMin: valorMin ? Number(valorMin) : 350000,
          valorMax: valorMax ? Number(valorMax) : 2500000,
          limiteDiario: limite ? Number(limite) : 15,
        },
      });
    }

    const results = await collectEemovelOpportunities({
      bairros,
      valorMin,
      valorMax,
      limite,
    });

    return NextResponse.json({
      success: true,
      message: `${results.length} oportunidades sincronizadas com sucesso do eEmovel!`,
      total: results.length,
      opportunities: results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
