import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, canUser } from "@/lib/api-auth";
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
    const requestedCorretorId = searchParams.get("corretorId") || undefined;
    const statusId = searchParams.get("statusId") || undefined;
    const limite = parseInt(searchParams.get("limite") || "100", 10);
    const isExport = searchParams.get("export") === "true";

    // Permission check: View leads
    const canViewLeads = await canUser(user.id, "imoview.view_leads");
    if (!canViewLeads) {
      return NextResponse.json(
        { status: false, message: "Acesso a leads parados não autorizado para seu perfil.", error: "Forbidden" },
        { status: 403 }
      );
    }

    // Permission check: Export spreadsheets (DLP)
    const canExport = await canUser(user.id, "imoview.export_sheets");
    if (isExport && !canExport) {
      return NextResponse.json(
        { status: false, message: "Exportação de planilhas desativada para proteger a base de clientes.", error: "Forbidden" },
        { status: 403 }
      );
    }

    // Broker Isolation check
    const canViewAllBrokers = await canUser(user.id, "imoview.view_all_brokers");
    let activeCorretorId = requestedCorretorId;

    if (!canViewAllBrokers) {
      // Force restriction to this user's linked Imoview broker
      if (!user.imoviewCorretorCodigo) {
        return NextResponse.json({
          status: true,
          message: "Seu usuário ainda não está vinculado a um corretor do Imoview. Solicite ao gestor vincular seu perfil.",
          configured: true,
          data: [],
          restrictedToBroker: null,
          canExport,
        });
      }
      activeCorretorId = user.imoviewCorretorCodigo;
    }

    const config = await getImoviewConfig();
    if (!config.apiKey) {
      return NextResponse.json({
        status: true,
        message: "Chave do Imoview não configurada. Configure a chave de API na aba de configurações.",
        configured: false,
        data: [],
        canExport,
      });
    }

    const leads = await fetchImoviewStalledLeads({
      diasSemContato: dias,
      corretorId: activeCorretorId,
      statusId,
      limite,
    });

    return NextResponse.json({
      status: true,
      message: `${leads.length} leads parados encontrados no Imoview`,
      configured: true,
      data: leads,
      restrictedToBroker: canViewAllBrokers ? null : (user.imoviewCorretorNome || user.imoviewCorretorCodigo),
      canExport,
    });
  } catch (error: any) {
    console.error("Fetch stalled leads error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar leads do Imoview", error: error.message },
      { status: 500 }
    );
  }
}
