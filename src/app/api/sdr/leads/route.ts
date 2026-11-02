import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase();
    const status = searchParams.get("status")?.trim();
    const temperatura = searchParams.get("temperatura")?.trim();
    const corretor = searchParams.get("corretor")?.trim();

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (temperatura && temperatura !== "ALL") {
      where.temperatura = temperatura;
    }

    if (corretor && corretor !== "ALL") {
      where.corretorNome = { contains: corretor, mode: "insensitive" };
    }

    if (search) {
      where.OR = [
        { leadNome: { contains: search, mode: "insensitive" } },
        { leadPhone: { contains: search } },
        { codigoImovel: { contains: search } },
      ];
    }

    const leads = await prisma.sdrLead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 2,
            },
          },
        },
      },
    });

    // Calcula KPIs em tempo real
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [totalHoje, emQualificacao, visitasAgendadas, contingencia, noShowsPrevenidos] = await Promise.all([
      prisma.sdrLead.count({ where: { createdAt: { gte: hoje } } }),
      prisma.sdrLead.count({ where: { status: { in: ["CONTACTED", "QUALIFYING"] } } }),
      prisma.sdrLead.count({ where: { status: { in: ["VISIT_CONFIRMED", "HANDED_OFF"] } } }),
      prisma.sdrLead.count({ where: { status: { in: ["NURTURE", "NO_RESPONSE"] } } }),
      prisma.sdrLead.count({
        where: {
          status: { in: ["VISIT_CONFIRMED", "HANDED_OFF"] },
          visitaDataHora: { not: null },
        },
      }),
    ]);

    const totalAtendidos = await prisma.sdrLead.count();
    const taxaConversao = totalAtendidos > 0 ? Math.round((visitasAgendadas / totalAtendidos) * 100) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalHoje,
        emQualificacao,
        visitasAgendadas,
        contingencia,
        noShowsPrevenidos,
        taxaConversao,
      },
      leads,
    });
  } catch (error: any) {
    console.error("Erro na API /api/sdr/leads:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leadNome, leadPhone, codigoImovel, origem, observacoes } = body;

    if (!leadNome || !leadPhone) {
      return NextResponse.json({ success: false, error: "Nome e Telefone são obrigatórios" }, { status: 400 });
    }

    const cleanDigits = leadPhone.replace(/\D/g, "");
    const fullPhone = cleanDigits.startsWith("55") ? cleanDigits : `55${cleanDigits}`;
    const leadJid = `${fullPhone}@s.whatsapp.net`;

    const lead = await prisma.sdrLead.create({
      data: {
        leadNome,
        leadPhone: fullPhone,
        leadJid,
        codigoImovel: codigoImovel || null,
        origem: origem || "Manual Dashboard",
        observacoesCamila: observacoes || null,
        rawIntakeText: `Manual: ${leadNome} - ${leadPhone} - Imóvel ${codigoImovel || "N/A"}`,
        status: "NEW",
        temperatura: "MORNO",
      },
    });

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    console.error("Erro ao criar lead manualmente:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Error" }, { status: 500 });
  }
}
