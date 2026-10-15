import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const brokerContactSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  telefone: z.string().min(8, "Telefone inválido"),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  imoviewCodigo: z.string().optional().nullable().or(z.literal("")),
  equipe: z.string().optional().nullable().or(z.literal("")),
  ativo: z.boolean().default(true),
  observacoes: z.string().optional().nullable().or(z.literal("")),
});

// GET /api/broker-contacts - List all registered brokers
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const somenteAtivos = searchParams.get("ativo") === "true";

    const whereClause: any = {};
    if (somenteAtivos) {
      whereClause.ativo = true;
    }
    if (q) {
      whereClause.OR = [
        { nome: { contains: q } },
        { telefone: { contains: q } },
        { email: { contains: q } },
        { imoviewCodigo: { contains: q } },
        { equipe: { contains: q } },
      ];
    }

    const brokers = await prisma.brokerContact.findMany({
      where: whereClause,
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });

    return NextResponse.json({
      status: true,
      data: brokers,
      count: brokers.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao listar corretores", error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/broker-contacts - Create a new broker contact
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = brokerContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Dados inválidos", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Normalizar telefone (apenas números para pesquisa consistente)
    let cleanPhone = parsed.data.telefone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = `55${cleanPhone}`;
    }

    const newBroker = await prisma.brokerContact.create({
      data: {
        nome: parsed.data.nome.trim(),
        telefone: cleanPhone,
        email: parsed.data.email?.trim() || null,
        imoviewCodigo: parsed.data.imoviewCodigo?.trim() || null,
        equipe: parsed.data.equipe?.trim() || "Vendas",
        ativo: parsed.data.ativo,
        observacoes: parsed.data.observacoes?.trim() || null,
      },
    });

    return NextResponse.json({
      status: true,
      message: "Corretor cadastrado com sucesso!",
      data: newBroker,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao cadastrar corretor", error: error.message },
      { status: 500 }
    );
  }
}
