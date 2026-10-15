import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateBrokerSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório").optional(),
  telefone: z.string().min(8, "Telefone inválido").optional(),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  imoviewCodigo: z.string().optional().nullable().or(z.literal("")),
  equipe: z.string().optional().nullable().or(z.literal("")),
  ativo: z.boolean().optional(),
  observacoes: z.string().optional().nullable().or(z.literal("")),
});

// PUT /api/broker-contacts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canAccess = isAdmin(user.role) || (await canUser(user.id, "management.broker_support_radar"));
    if (!canAccess) {
      return NextResponse.json(
        { status: false, message: "Acesso restrito ao perfil de gestão comercial." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateBrokerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Dados inválidos", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (parsed.data.nome !== undefined) updateData.nome = parsed.data.nome.trim();
    if (parsed.data.telefone !== undefined) {
      let cleanPhone = parsed.data.telefone.replace(/\D/g, "");
      if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = `55${cleanPhone}`;
      }
      updateData.telefone = cleanPhone;
    }
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email?.trim() || null;
    if (parsed.data.imoviewCodigo !== undefined) updateData.imoviewCodigo = parsed.data.imoviewCodigo?.trim() || null;
    if (parsed.data.equipe !== undefined) updateData.equipe = parsed.data.equipe?.trim() || null;
    if (parsed.data.ativo !== undefined) updateData.ativo = parsed.data.ativo;
    if (parsed.data.observacoes !== undefined) updateData.observacoes = parsed.data.observacoes?.trim() || null;

    const updated = await prisma.brokerContact.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      status: true,
      message: "Corretor atualizado com sucesso!",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao atualizar corretor", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/broker-contacts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canAccess = isAdmin(user.role) || (await canUser(user.id, "management.broker_support_radar"));
    if (!canAccess) {
      return NextResponse.json(
        { status: false, message: "Acesso restrito ao perfil de gestão comercial." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await prisma.brokerContact.delete({
      where: { id },
    });

    return NextResponse.json({
      status: true,
      message: "Corretor removido com sucesso!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao excluir corretor", error: error.message },
      { status: 500 }
    );
  }
}
