import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { z } from "zod";

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  content: z.string().min(1).optional(),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
});

// PUT: Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.messageTemplate.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { status: false, message: "Modelo não encontrado" },
        { status: 404 }
      );
    }

    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({
      status: true,
      message: "Modelo atualizado com sucesso",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Falha ao atualizar modelo", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { status: false, message: "Modelo não encontrado" },
        { status: 404 }
      );
    }

    await prisma.messageTemplate.delete({ where: { id } });

    return NextResponse.json({
      status: true,
      message: "Modelo excluído com sucesso",
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Falha ao excluir modelo", error: error.message },
      { status: 500 }
    );
  }
}
