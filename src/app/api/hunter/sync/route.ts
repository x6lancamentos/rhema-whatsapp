import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { collectEemovelOpportunities } from "@/lib/hunter/eemovel-service";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";

const syncOptionsSchema = z
  .object({
    bairros: z.union([z.string(), z.array(z.string())]).optional(),
    valorMin: z.coerce.number().positive().optional(),
    valorMax: z.coerce.number().positive().optional(),
    limite: z.coerce.number().int().positive().max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.valorMin && data.valorMax) {
        return data.valorMax >= data.valorMin;
      }
      return true;
    },
    {
      message: "valorMax deve ser maior ou igual a valorMin",
      path: ["valorMax"],
    }
  );

export async function POST(req: NextRequest) {
  // 1. Guard de Autenticação & Autorização
  const { error } = await requireApiAuth(req, ["ADMIN", "SUPERADMIN"]);
  if (error) return error;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = syncOptionsSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Parâmetros de sincronização inválidos",
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { bairros, valorMin, valorMax, limite } = parseResult.data;
    const bairrosList = bairros ? (Array.isArray(bairros) ? bairros : [bairros]) : undefined;

    // Se parâmetros foram passados, salva no config default
    if (bairrosList || valorMin || valorMax || limite) {
      await prisma.hunterConfig.upsert({
        where: { id: "default" },
        update: {
          bairrosSantos: bairrosList,
          valorMin,
          valorMax,
          limiteDiario: limite,
        },
        create: {
          id: "default",
          bairrosSantos: bairrosList || ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida"],
          tiposImovel: ["Apartamento", "Casa", "Cobertura"],
          valorMin: valorMin ?? 350000,
          valorMax: valorMax ?? 2500000,
          limiteDiario: limite ?? 15,
        },
      });
    }

    const results = await collectEemovelOpportunities({
      bairros: bairrosList,
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
