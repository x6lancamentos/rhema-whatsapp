import { NextResponse } from "next/server";
import { collectEemovelOpportunities } from "@/lib/hunter/eemovel-service";

export async function POST() {
  try {
    const results = await collectEemovelOpportunities();
    return NextResponse.json({
      success: true,
      message: `${results.length} oportunidades sincronizadas com sucesso do EEmovel!`,
      total: results.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
