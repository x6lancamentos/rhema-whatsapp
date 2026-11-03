import { NextRequest, NextResponse } from "next/server";
import { approveEvolutionProposal } from "@/lib/ai/coaching/agent-debate-service";
import { requireApiAuth } from "@/lib/api-auth-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Guard de Autenticação & Autorização estrita (ADMIN / SUPERADMIN)
  const { user, error } = await requireApiAuth(req, ["ADMIN", "SUPERADMIN"]);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Identifica com precisão para auditoria o gestor autenticado
    const gestorEmail = user?.email || "gestor@rhemaimobiliaria.com.br";
    const gestorNome = user?.name
      ? `${user.name} (${gestorEmail})`
      : body.gestorNome || `Gestor (${gestorEmail})`;

    const approved = await approveEvolutionProposal(id, gestorNome);
    return NextResponse.json({
      success: true,
      message: `Proposta ${approved.learnId} aprovada com sucesso por ${gestorNome}! O novo System Prompt está ativo em produção.`,
      proposal: approved,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
