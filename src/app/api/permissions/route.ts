import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { 
  PERMISSION_DEFINITIONS, 
  PERMISSION_CATEGORIES, 
  getAllRolesPermissions, 
  getUserEffectivePermissions,
  PermissionKey 
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET: Returns permission definitions, category mappings, all role presets, and current user's effective permissions
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const [allRoles, userPerms] = await Promise.all([
      getAllRolesPermissions(),
      getUserEffectivePermissions(user.id),
    ]);

    return NextResponse.json({
      status: true,
      data: {
        definitions: PERMISSION_DEFINITIONS,
        categories: PERMISSION_CATEGORIES,
        roles: allRoles,
        currentUser: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: userPerms.permissions,
          imoviewCorretorNome: userPerms.imoviewCorretorNome,
          imoviewCorretorCodigo: userPerms.imoviewCorretorCodigo,
        },
      },
    });
  } catch (error: any) {
    console.error("Fetch permissions error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar permissões", error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update permission preset for a specific Role
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canUser(user.id, "users.manage_permissions");
    if (!isAdmin(user.role) && !canManage) {
      return NextResponse.json(
        { status: false, message: "Sem autorização para alterar permissões de perfis." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role, permissions } = body;

    if (!role || !permissions || typeof permissions !== "object") {
      return NextResponse.json(
        { status: false, message: "Dados inválidos: role e permissions são obrigatórios." },
        { status: 400 }
      );
    }

    const targetRole = role as Role;
    if (targetRole === "SUPERADMIN") {
      return NextResponse.json(
        { status: false, message: "Não é permitido restringir o perfil Super Admin." },
        { status: 400 }
      );
    }

    const updated = await prisma.rolePermissionConfig.upsert({
      where: { role: targetRole },
      create: {
        role: targetRole,
        permissions,
      },
      update: {
        permissions,
      },
    });

    return NextResponse.json({
      status: true,
      message: `Permissões do perfil ${targetRole} atualizadas com sucesso!`,
      data: updated,
    });
  } catch (error: any) {
    console.error("Update role permissions error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao atualizar permissões do perfil", error: error.message },
      { status: 500 }
    );
  }
}
