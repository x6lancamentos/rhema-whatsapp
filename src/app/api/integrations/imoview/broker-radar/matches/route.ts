import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import {
  fetchRecentStockProperties,
  fetchHotLeadsForRadar,
  computeStockLeadMatches,
} from "@/lib/imoview-broker-radar";

export const dynamic = "force-dynamic";

// GET /api/integrations/imoview/broker-radar/matches
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const canAccess = isAdmin(user.role) || (await canUser(user.id, "management.broker_support_radar"));
    if (!canAccess) {
      return NextResponse.json(
        { status: false, message: "Acesso restrito ao perfil de gestão comercial." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const diasEstoque = parseInt(searchParams.get("diasEstoque") || "7", 10);
    const leadMode = (searchParams.get("leadMode") || "hot_7days") as "hot_7days" | "all_active";
    const bairro = searchParams.get("bairro") || undefined;
    const tipo = searchParams.get("tipo") || undefined;
    const corretorCodigo = searchParams.get("corretorCodigo") || undefined;
    const finalidade = searchParams.get("finalidade") || "2"; // Venda por padrão

    // Busca em paralelo na API do Imoview em tempo real
    const [properties, leads] = await Promise.all([
      fetchRecentStockProperties({
        diasMaximos: diasEstoque,
        finalidade,
        bairro,
        tipo,
        limite: 60,
      }),
      fetchHotLeadsForRadar({
        mode: leadMode,
        corretorCodigo,
        limite: 150,
      }),
    ]);

    // Executa algoritmo de matching multicritério
    const matches = computeStockLeadMatches(properties, leads);

    return NextResponse.json({
      status: true,
      data: {
        matches,
        propertiesCount: properties.length,
        leadsCount: leads.length,
        matchesCount: matches.length,
        properties,
        leads,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao calcular combinações de estoque e leads", error: error.message },
      { status: 500 }
    );
  }
}
