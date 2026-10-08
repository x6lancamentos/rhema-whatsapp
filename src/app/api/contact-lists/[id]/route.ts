import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";

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
