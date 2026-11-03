import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerAgentDebateSession } from "@/lib/ai/coaching/agent-debate-service";

export async function GET() {
  try {
    const proposals = await prisma.promptEvolutionProposal.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ success: true, proposals });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const modulo = body.modulo || "HUNTER_CAPTACAO";

    const sessionResult = await triggerAgentDebateSession(modulo);
    return NextResponse.json({
      success: true,
      message: "Sessão de debate concluída com sucesso entre Master Coach e Data Analyst!",
      sessionResult,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
