import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { fetchImoviewStalledLeads, getImoviewConfig } from "@/lib/imoview";

// GET: Fetch stalled leads from Imoview for reactivation
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dias = parseInt(searchParams.get("dias") || "7", 10);
    const corretorId = searchParams.get("corretorId") || undefined;
    const statusId = searchParams.get("statusId") || undefined;
    const limite = parseInt(searchParams.get("limite") || "100", 10);

    const config = await getImoviewConfig();
    if (!config.apiKey) {
      return NextResponse.json({
        status: true,
        message: "Chave do Imoview não configurada. Configure a chave de API na aba de configurações.",
        configured: false,
        data: [],
      });
    }

    const leads = await fetchImoviewStalledLeads({
      diasSemContato: dias,
      corretorId,
      statusId,
      limite,
    });

    return NextResponse.json({
      status: true,
      message: `${leads.length} leads parados encontrados no Imoview`,
      configured: true,
      data: leads,
    });
  } catch (error: any) {
    console.error("Fetch stalled leads error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar leads do Imoview", error: error.message },
      { status: 500 }
    );
  }
}
