import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { z } from "zod";

const updateContactListSchema = z.object({
  name: z.string().min(1, "Nome da lista é obrigatório").optional(),
  description: z.string().optional().nullable(),
  contacts: z.array(z.record(z.string(), z.any())).min(1, "A lista precisa ter pelo menos 1 contato").optional(),
});

// GET: Get full contact list with contacts payload
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const list = await prisma.contactList.findFirst({
      where: { id, userId: user.id },
    });

    if (!list) {
      return NextResponse.json({ status: false, message: "Lista não encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      status: true,
      message: "Lista carregada com sucesso",
      data: list,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Falha ao carregar lista", error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update a saved contact list (name or contacts)
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
    const existing = await prisma.contactList.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ status: false, message: "Lista não encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateContactListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.contacts !== undefined) {
      updateData.contacts = parsed.data.contacts;
      updateData.totalCount = parsed.data.contacts.length;
    }

    const updated = await prisma.contactList.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      status: true,
      message: "Lista atualizada com sucesso",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Falha ao atualizar lista", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a saved contact list
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
    const existing = await prisma.contactList.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ status: false, message: "Lista não encontrada" }, { status: 404 });
    }

    await prisma.contactList.delete({ where: { id } });

    return NextResponse.json({
      status: true,
      message: "Lista excluída com sucesso",
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Falha ao excluir lista", error: error.message },
      { status: 500 }
    );
  }
}
