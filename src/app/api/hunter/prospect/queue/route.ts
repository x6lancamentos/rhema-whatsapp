import { NextResponse } from "next/server";
import { startHunterQueue, pauseHunterQueue } from "@/lib/hunter/hunter-orchestrator";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "start";

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

