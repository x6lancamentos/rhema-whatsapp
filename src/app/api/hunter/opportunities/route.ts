import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const bairro = searchParams.get("bairro")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const where: any = {};
    if (status) where.status = status;
    if (bairro) where.bairro = { contains: bairro, mode: "insensitive" };
    if (search) {
      where.OR = [
        { proprietarioNome: { contains: search, mode: "insensitive" } },
        { proprietarioTelefone: { contains: search } },
        { titulo: { contains: search, mode: "insensitive" } },
        { enderecoAprox: { contains: search, mode: "insensitive" } },
      ];
    }

    const [opportunities, totalCount, statusCounts, totalVgvAgg] = await Promise.all([
      prisma.hunterOpportunity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          cadenceLogs: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      }),
      prisma.hunterOpportunity.count(),
      prisma.hunterOpportunity.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.hunterOpportunity.aggregate({
        _sum: { valorPretendido: true },
      }),
    ]);

    const countsMap: Record<string, number> = {};
    for (const s of statusCounts) {
      countsMap[s.status] = s._count.id;
    }

    const stats = {
      total: totalCount,
      descobertos: countsMap["DISCOVERED"] || 0,
      emFila: countsMap["QUEUED"] || 0,
      emAbordagem: countsMap["APPROACHING"] || 0,
      negociando: countsMap["NEGOTIATING"] || 0,
      visitaAceita: countsMap["VISIT_ACCEPTED"] || 0,
      captadosExclusivos: countsMap["CAPTURED_EXCLUSIVE"] || 0,
      captadosGerais: countsMap["CAPTURED_GENERAL"] || 0,
      descartados: (countsMap["REJECTED"] || 0) + (countsMap["FAKE_OWNER"] || 0),
      vgvMapeado: totalVgvAgg._sum.valorPretendido || 0,
    };

    return NextResponse.json({ success: true, stats, opportunities });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
