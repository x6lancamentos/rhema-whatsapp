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
            take: 5,
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID da oportunidade é obrigatório" }, { status: 400 });
    }

    const existing = await prisma.hunterOpportunity.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Oportunidade não encontrada" }, { status: 404 });
    }

    const updateData: any = {};

    if (data.status !== undefined) updateData.status = String(data.status);
    if (data.titulo !== undefined) updateData.titulo = String(data.titulo);
    if (data.bairro !== undefined) updateData.bairro = String(data.bairro);
    if (data.cidade !== undefined) updateData.cidade = String(data.cidade);
    if (data.tipoImovel !== undefined) updateData.tipoImovel = String(data.tipoImovel);
    if (data.tipoOportunidade !== undefined) updateData.tipoOportunidade = String(data.tipoOportunidade);

    if (data.valorPretendido !== undefined) {
      updateData.valorPretendido = Number(data.valorPretendido) || 0;
    }
    if (data.condominio !== undefined) updateData.condominio = Number(data.condominio) || null;
    if (data.iptu !== undefined) updateData.iptu = Number(data.iptu) || null;
    if (data.quartos !== undefined) updateData.quartos = Number(data.quartos) || null;
    if (data.vagas !== undefined) updateData.vagas = Number(data.vagas) || null;
    if (data.areaM2 !== undefined) updateData.areaM2 = Number(data.areaM2) || null;
    if (data.enderecoAprox !== undefined) updateData.enderecoAprox = String(data.enderecoAprox);

    if (data.proprietarioNome !== undefined) {
      updateData.proprietarioNome = String(data.proprietarioNome);
    }

    if (data.proprietarioTelefone !== undefined) {
      const cleanPhone = String(data.proprietarioTelefone).replace(/\D/g, "");
      updateData.proprietarioTelefone = cleanPhone;
      updateData.proprietarioJid = cleanPhone.startsWith("55")
        ? `${cleanPhone}@s.whatsapp.net`
        : `55${cleanPhone}@s.whatsapp.net`;
    }

    // Atualiza dadosEemovel (preservando e integrando linkAnuncio ou notas)
    if (data.linkAnuncio !== undefined || data.notas !== undefined) {
      const currentDados = (existing.dadosEemovel as any) || {};
      updateData.dadosEemovel = {
        ...currentDados,
        ...(data.linkAnuncio !== undefined ? { linkAnuncio: data.linkAnuncio } : {}),
        ...(data.notas !== undefined ? { notas: data.notas } : {}),
      };
    }

    const updated = await prisma.hunterOpportunity.update({
      where: { id },
      data: updateData,
      include: {
        cadenceLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Oportunidade atualizada com sucesso!",
      opportunity: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    let action = searchParams.get("action");

    // Permite receber dados via body também
    try {
      const body = await req.json().catch(() => null);
      if (body) {
        if (body.id) id = body.id;
        if (body.action) action = body.action;
      }
    } catch { }

    // 1. Limpeza em lote de dados fictícios de teste
    if (action === "purge_mock" || action === "purge_test") {
      const result = await prisma.hunterOpportunity.deleteMany({
        where: {
          OR: [
            { externalId: { startsWith: "eemovel-santos-" } },
            { externalId: { contains: "mock" } },
            {
              proprietarioNome: {
                in: [
                  "Dr. Roberto Martins",
                  "Cláudia Mendonça",
                  "Carlos Eduardo Ferraz",
                  "Dona Regina Duarte",
                  "Eng. Marcelo Siqueira",
                  "Dr. Marcelo Siqueira",
                  "Eng. Roberto Vianna",
                  "Renata Bittencourt",
                  "Fernando Alencar",
                  "Silvia Guimarães",
                  "Alexandre Fontes",
                  "Beatriz Vasconcelos",
                ],
              },
            },
          ],
        },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} dados fictícios de teste removidos com sucesso!`,
        count: result.count,
      });
    }

    // 2. Limpeza de descartados
    if (action === "purge_rejected") {
      const result = await prisma.hunterOpportunity.deleteMany({
        where: {
          status: { in: ["REJECTED", "FAKE_OWNER"] },
        },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} cards descartados foram excluídos definitivamente!`,
        count: result.count,
      });
    }

    // 3. Exclusão de card individual
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID da oportunidade ou ação válida necessária" },
        { status: 400 }
      );
    }

    await prisma.hunterOpportunity.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Oportunidade removida com sucesso!",
      deletedId: id,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
