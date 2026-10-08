import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { z } from "zod";

const createContactListSchema = z.object({
  name: z.string().min(1, "Nome da lista é obrigatório"),
  description: z.string().optional().nullable(),
  contacts: z.array(z.record(z.string(), z.any())).min(1, "A lista precisa ter pelo menos 1 contato"),
});

// GET: List all saved contact lists
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const lists = await prisma.contactList.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        totalCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      status: true,
      message: "Listas de contatos carregadas",
      data: lists,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Falha ao carregar listas", error: error.message },
      { status: 500 }
    );
  }
}

// POST: Save a new contact list
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createContactListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const contactList = await prisma.contactList.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        contacts: parsed.data.contacts as any,
        totalCount: parsed.data.contacts.length,
      },
    });

    return NextResponse.json({
      status: true,
      message: "Lista salva com sucesso",
      data: {
        id: contactList.id,
        name: contactList.name,
        totalCount: contactList.totalCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Falha ao salvar lista", error: error.message },
      { status: 500 }
    );
  }
}
