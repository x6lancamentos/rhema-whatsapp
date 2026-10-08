import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { z } from "zod";

const controlSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; broadcastId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, broadcastId } = await params;
    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) {
      return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = controlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ status: false, message: "Ação inválida" }, { status: 400 });
    }

    const { action } = parsed.data;

    let newStatus: string;
    if (action === "pause") newStatus = "paused";
    else if (action === "resume") newStatus = "running";
    else newStatus = "cancelled";

    const updated = await prisma.broadcastLog.update({
      where: { id: broadcastId },
      data: {
        status: newStatus,
        ...(action === "cancel" ? { completedAt: new Date() } : {}),
      },
    });

    const io = (global as any).io;
    if (io) {
      io.to(sessionId).emit("broadcast.control", {
        broadcastId,
        status: newStatus,
      });
    }

    return NextResponse.json({
      status: true,
      message: `Disparo ${newStatus === 'paused' ? 'pausado' : newStatus === 'running' ? 'retomado' : 'cancelado'} com sucesso`,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao controlar disparo", error: error.message },
      { status: 500 }
    );
  }
}
