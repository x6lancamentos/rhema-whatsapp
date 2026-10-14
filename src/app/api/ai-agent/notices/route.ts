import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "ALL") {
      where.statusProcessamento = status;
    }

    const notices = await prisma.aiPropertyUpdateNotice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const pendingCount = await prisma.aiPropertyUpdateNotice.count({
      where: { statusProcessamento: "PENDENTE" },
    });

    const totalCount = await prisma.aiPropertyUpdateNotice.count();

    return NextResponse.json({
      success: true,
      notices,
      stats: {
        pendingCount,
        totalCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao buscar avisos" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, statusProcessamento, resolvidoPor } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do aviso não informado." },
        { status: 400 }
      );
    }

    const updated = await prisma.aiPropertyUpdateNotice.update({
      where: { id },
      data: {
        statusProcessamento: statusProcessamento || "CONCLUIDO_IMOVIEW",
        resolvidoPor: resolvidoPor || "Recepção Rhema",
        resolvidoEm: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, notice: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar status do aviso" },
      { status: 500 }
    );
  }
}
