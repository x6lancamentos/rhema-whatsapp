import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Nome do modelo é obrigatório"),
  category: z.string().optional().default("Geral"),
  content: z.string().min(1, "Conteúdo da mensagem é obrigatório"),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
});

import { REAL_ESTATE_DEFAULT_TEMPLATES } from "@/lib/default-templates";

// GET: List all templates for the current user (auto-seeds defaults if empty)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    let templates = await prisma.messageTemplate.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    // Auto-seed default real estate templates on first access
    if (templates.length === 0) {
      for (const tpl of REAL_ESTATE_DEFAULT_TEMPLATES) {
        await prisma.messageTemplate.create({
          data: {
            userId: user.id,
            name: tpl.name,
            category: tpl.category,
            content: tpl.content,
          },
        });
      }

      templates = await prisma.messageTemplate.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
      });
    }

    return NextResponse.json({
      status: true,
      message: "Templates retrieved successfully",
      data: templates,
    });
  } catch (error: any) {
    console.error("Get templates error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch templates", error: error.message },
      { status: 500 }
    );
  }
}

// POST: Create a new template
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const template = await prisma.messageTemplate.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        category: parsed.data.category || "Geral",
        content: parsed.data.content,
        mediaUrl: parsed.data.mediaUrl,
        mediaType: parsed.data.mediaType,
      },
    });

    return NextResponse.json({
      status: true,
      message: "Template criado com sucesso",
      data: template,
    });
  } catch (error: any) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { status: false, message: "Falha ao criar modelo", error: error.message },
      { status: 500 }
    );
  }
}
