import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";

// DELETE: Remove phone from blacklist
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

    const existing = await prisma.blacklist.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { status: false, message: "Registro não encontrado" },
        { status: 404 }
      );
    }

    await prisma.blacklist.delete({
      where: { id },
    });

    return NextResponse.json({
      status: true,
      message: "Número removido da lista negra com sucesso",
    });
  } catch (error: any) {
    console.error("Delete blacklist error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to delete blacklist entry", error: error.message },
      { status: 500 }
    );
  }
}
