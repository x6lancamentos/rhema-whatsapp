import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startHunterQueue, pauseHunterQueue } from "@/lib/hunter/hunter-orchestrator";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";

const queueActionSchema = z.object({
  action: z.enum(["start", "pause"]),
});

export async function GET(req: NextRequest) {
  const { error } = await requireApiAuth(req, ["ADMIN", "SUPERADMIN"]);
  if (error) return error;

  try {
    const [config, queuedCount, discoveredCount] = await Promise.all([
      prisma.hunterConfig.findUnique({ where: { id: "default" } }),
      prisma.hunterOpportunity.count({ where: { status: "QUEUED" } }),
      prisma.hunterOpportunity.count({ where: { status: "DISCOVERED" } }),
    ]);

    return NextResponse.json({
      success: true,
      ativo: config?.ativo ?? false,
      queuedCount,
      discoveredCount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireApiAuth(req, ["ADMIN", "SUPERADMIN"]);
  if (error) return error;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = queueActionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Ação inválida. Use 'start' ou 'pause'.",
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { action } = parseResult.data;

    if (action === "pause") {
      const res = await pauseHunterQueue();
      return NextResponse.json(res);
    } else {
      const res = await startHunterQueue();
      return NextResponse.json(res);
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
