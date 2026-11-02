import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { waManager } from "@/modules/whatsapp/manager";
import { runSdrFollowupTick } from "@/lib/ai/sdr/sdr-followup";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const lead = await prisma.sdrLead.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
        learningInsights: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, corretorNome, corretorId, temperatura, forceFollowup, visitaDataHora } = body;

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (corretorNome !== undefined) dataToUpdate.corretorNome = corretorNome;
    if (corretorId !== undefined) dataToUpdate.corretorId = corretorId;
    if (temperatura) dataToUpdate.temperatura = temperatura;
    if (visitaDataHora) dataToUpdate.visitaDataHora = new Date(visitaDataHora);

    const updated = await prisma.sdrLead.update({
      where: { id },
      data: dataToUpdate,
    });

    // Se solicitado forçar o follow-up imediatamente
    if (forceFollowup) {
      const sessionId = process.env.RHEMA_SDR_SESSION_ID || "5mhrx9";
      const sock = waManager.getInstance(sessionId)?.socket;
      if (sock) {
        await prisma.sdrLead.update({
          where: { id },
          data: { nextFollowupAt: new Date(Date.now() - 1000) }, // força timestamp no passado
        });
        await runSdrFollowupTick(sock);
      }
    }

    return NextResponse.json({ success: true, lead: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.sdrLead.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Lead removido com sucesso" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
