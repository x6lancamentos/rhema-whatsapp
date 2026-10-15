import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin, canUser } from "@/lib/api-auth";
import { fetchBrokerCadenceData } from "@/lib/imoview-broker-radar";

export const dynamic = "force-dynamic";

// GET /api/integrations/imoview/broker-radar/cadence
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

    const cadenceList = await fetchBrokerCadenceData();

    // Sumarização executiva para o Gestor (Brunno)
    const summary = {
      totalCorretores: cadenceList.length,
      criticos: cadenceList.filter((c) => c.statusSla === "CRITICO").length,
      emAtencao: cadenceList.filter((c) => c.statusSla === "ATENCAO").length,
      emDia: cadenceList.filter((c) => c.statusSla === "EM_DIA").length,
      totalAtividadesVencidas: cadenceList.reduce((acc, c) => acc + c.atividadesVencidas, 0),
      totalAtividadesHoje: cadenceList.reduce((acc, c) => acc + c.atividadesHoje, 0),
      totalLeadsParados7Dias: cadenceList.reduce((acc, c) => acc + c.leadsSemContatoMais7Dias, 0),
    };

    return NextResponse.json({
      status: true,
      data: {
        summary,
        cadence: cadenceList,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao buscar cadência de atividades dos corretores", error: error.message },
      { status: 500 }
    );
  }
}
