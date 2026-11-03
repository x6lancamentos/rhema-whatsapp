import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { approachSingleOpportunity } from "@/lib/hunter/hunter-orchestrator";
import { requireApiAuth } from "@/lib/api-auth-guard";

const singleProspectSchema = z.object({
  opportunityId: z.string().min(1, "ID da oportunidade obrigatório"),
});

export async function POST(req: NextRequest) {
  // 1. Guard de Autenticação & Autorização
  const { error } = await requireApiAuth(req, ["ADMIN", "SUPERADMIN"]);
  if (error) return error;

  try {
    const rawBody = await req.json().catch(() => null);
    const parseResult = singleProspectSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Payload inválido",
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { opportunityId } = parseResult.data;
    const result = await approachSingleOpportunity(opportunityId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
