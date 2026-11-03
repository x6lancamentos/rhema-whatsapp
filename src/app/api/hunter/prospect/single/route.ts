import { NextResponse } from "next/server";
import { approachSingleOpportunity } from "@/lib/hunter/hunter-orchestrator";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { opportunityId } = body;

    if (!opportunityId) {
      return NextResponse.json({ success: false, error: "ID da oportunidade obrigatório" }, { status: 400 });
    }

    const result = await approachSingleOpportunity(opportunityId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

