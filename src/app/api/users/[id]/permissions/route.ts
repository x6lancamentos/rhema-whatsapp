import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { getUserEffectivePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Fetch effective permissions and individual overrides for a specific user
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

    // Allow user to see their own permissions or admin/manager to see any
    const canManage = await canUser(user.id, "users.manage_permissions");
    if (user.id !== id && !isAdmin(user.role) && !canManage) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 403 });
    }

    const effective = await getUserEffectivePermissions(id);

    return NextResponse.json({
      status: true,
      data: effective,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao buscar permissões do usuário", error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Save custom granular overrides for an individual user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canUser(user.id, "users.manage_permissions");
    if (!isAdmin(user.role) && !canManage) {
      return NextResponse.json(
        { status: false, message: "Sem autorização para alterar permissões individuais." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { overrides } = body;

    if (overrides === undefined) {
      return NextResponse.json(
        { status: false, message: "Campo overrides obrigatório." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ status: false, message: "Usuário não encontrado." }, { status: 404 });
    }

    if (targetUser.role === "SUPERADMIN") {
      return NextResponse.json(
        { status: false, message: "Não é permitido alterar overrides de Super Admin." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        permissionsOverrides: overrides,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissionsOverrides: true,
      },
    });

    const effective = await getUserEffectivePermissions(id);

    return NextResponse.json({
      status: true,
      message: "Permissões personalizadas do usuário atualizadas com sucesso!",
      data: {
        user: updated,
        effective,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao salvar permissões do usuário", error: error.message },
      { status: 500 }
    );
  }
}
