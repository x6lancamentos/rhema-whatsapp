import { NextRequest, NextResponse } from "next/server";
import { approveEvolutionProposal } from "@/lib/ai/coaching/agent-debate-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const gestorNome = body.gestorNome || "Brunno Anastácio (Gerente)";

    const approved = await approveEvolutionProposal(id, gestorNome);
    return NextResponse.json({
      success: true,
      message: `Proposta ${approved.learnId} aprovada com sucesso! O novo System Prompt está ativo em produção.`,
      proposal: approved,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
