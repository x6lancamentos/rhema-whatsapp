import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { REAL_ESTATE_DEFAULT_TEMPLATES } from "@/lib/default-templates";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    let addedCount = 0;
    for (const tpl of REAL_ESTATE_DEFAULT_TEMPLATES) {
      const exists = await prisma.messageTemplate.findFirst({
        where: { userId: user.id, name: tpl.name },
      });
      if (!exists) {
        await prisma.messageTemplate.create({
          data: {
            userId: user.id,
            name: tpl.name,
            category: tpl.category,
            content: tpl.content,
          },
        });
        addedCount++;
      }
    }

    return NextResponse.json({
      status: true,
      message: `${addedCount} modelos adicionados à sua biblioteca`,
      count: addedCount,
    });
  } catch (error: any) {
    console.error("Seed templates error:", error);
    return NextResponse.json(
      { status: false, message: "Falha ao restaurar modelos", error: error.message },
      { status: 500 }
    );
  }
}
