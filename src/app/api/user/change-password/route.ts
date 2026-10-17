import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
  currentPassword: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { newPassword, currentPassword } = parsed.data;

    // Se o usuário não está em primeiro login forçado, confere senha atual se informada
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true, mustChangePassword: true },
    });

    if (!dbUser) {
      return NextResponse.json({ status: false, message: "Usuário não encontrado" }, { status: 404 });
    }

    if (!dbUser.mustChangePassword && currentPassword) {
      const match = await bcrypt.compare(currentPassword, dbUser.password);
      if (!match) {
        return NextResponse.json({ status: false, message: "Senha atual incorreta" }, { status: 400 });
      }
    }

    // Hashear nova senha pessoal
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    return NextResponse.json({
      status: true,
      message: "Senha atualizada com sucesso! Sua nova senha já está ativa.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao atualizar senha", error: error.message },
      { status: 500 }
    );
  }
}
