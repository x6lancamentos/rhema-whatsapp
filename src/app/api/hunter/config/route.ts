import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let config = await prisma.hunterConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    config = await prisma.hunterConfig.create({
      data: {
        id: "default",
        bairrosSantos: [
          "Embaré",
          "Gonzaga",
          "Ponta da Praia",
          "Boqueirão",
          "Aparecida",
          "Pompéia",
          "Campo Grande",
          "Marapé",
          "José Menino",
        ],
        valorMin: 350000,
        valorMax: 2500000,
        tiposImovel: ["Apartamento", "Casa", "Cobertura"],
        limiteDiario: 15,
        delayMinSeg: 45,
        delayMaxSeg: 180,
        ativo: true,
      },
    });
  }
  return NextResponse.json({ success: true, config });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bairrosSantos, valorMin, valorMax, limiteDiario, delayMinSeg, delayMaxSeg, ativo } = body;

    const updated = await prisma.hunterConfig.upsert({
      where: { id: "default" },
      update: {
        bairrosSantos: bairrosSantos ?? undefined,
        valorMin: valorMin !== undefined ? Number(valorMin) : undefined,
        valorMax: valorMax !== undefined ? Number(valorMax) : undefined,
        limiteDiario: limiteDiario !== undefined ? Number(limiteDiario) : undefined,
        delayMinSeg: delayMinSeg !== undefined ? Number(delayMinSeg) : undefined,
        delayMaxSeg: delayMaxSeg !== undefined ? Number(delayMaxSeg) : undefined,
        ativo: ativo !== undefined ? Boolean(ativo) : undefined,
      },
      create: {
        id: "default",
        bairrosSantos: bairrosSantos || ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida"],
        valorMin: Number(valorMin || 350000),
        valorMax: Number(valorMax || 2500000),
        tiposImovel: ["Apartamento", "Casa", "Cobertura"],
        limiteDiario: Number(limiteDiario || 15),
        delayMinSeg: Number(delayMinSeg || 45),
        delayMaxSeg: Number(delayMaxSeg || 180),
        ativo: ativo !== undefined ? Boolean(ativo) : true,
      },
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
