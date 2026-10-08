import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { sanitizePhoneNumber } from "@/lib/spintax";
import { z } from "zod";

const createBlacklistSchema = z.object({
  phone: z.string().min(8, "Número de telefone inválido"),
  reason: z.string().optional().default("Adicionado manualmente"),
});

// GET: List all blacklisted numbers for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";

    const blacklist = await prisma.blacklist.findMany({
      where: {
        userId: user.id,
        ...(search
          ? {
              OR: [
                { phone: { contains: search } },
                { reason: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      status: true,
      message: "Blacklist retrieved successfully",
      data: blacklist,
    });
  } catch (error: any) {
    console.error("Get blacklist error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to fetch blacklist", error: error.message },
      { status: 500 }
    );
  }
}

// POST: Add phone to blacklist
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createBlacklistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const sanitized = sanitizePhoneNumber(parsed.data.phone);
    const phone = sanitized.isValid ? sanitized.phone : parsed.data.phone.replace(/\D/g, "");
    const jid = sanitized.isValid ? sanitized.jid : `${phone}@s.whatsapp.net`;

    if (!phone || phone.length < 8) {
      return NextResponse.json(
        { status: false, message: "Número de telefone inválido" },
        { status: 400 }
      );
    }

    const entry = await prisma.blacklist.upsert({
      where: {
        userId_phone: {
          userId: user.id,
          phone,
        },
      },
      create: {
        userId: user.id,
        phone,
        jid,
        reason: parsed.data.reason || "Adicionado manualmente",
      },
      update: {
        reason: parsed.data.reason || "Adicionado manualmente",
      },
    });

    return NextResponse.json({
      status: true,
      message: "Número adicionado à lista negra",
      data: entry,
    });
  } catch (error: any) {
    console.error("Create blacklist error:", error);
    return NextResponse.json(
      { status: false, message: "Failed to add to blacklist", error: error.message },
      { status: 500 }
    );
  }
}
