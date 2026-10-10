import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, canUser } from "@/lib/api-auth";
import { fetchImoviewProperties, getImoviewConfig } from "@/lib/imoview";
import { upsertImoviewPropertiesContext } from "@/lib/imoview-context";

// GET: Fetch properties and owner contacts from Imoview
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dias = parseInt(searchParams.get("dias") || "0", 10);
    const diasMax = parseInt(searchParams.get("diasMax") || "0", 10);
    const dataInicio = searchParams.get("dataInicio") || undefined;
    const dataFim = searchParams.get("dataFim") || undefined;
    const finalidade = searchParams.get("finalidade") || "0";
    const tipo = searchParams.get("tipo") || undefined;
    const bairro = searchParams.get("bairro") || undefined;
    const situacao = searchParams.get("situacao") || undefined;
    const requestedCorretorId = searchParams.get("corretorId") || undefined;
    const termo = searchParams.get("termo") || undefined;
    const limite = parseInt(searchParams.get("limite") || "100", 10);
    const origem = (searchParams.get("origem") as "proprietarios" | "imoveis" | "rhema") || "proprietarios";
    const apenasComTelefone = searchParams.get("apenasComTelefone") === "true";
    const isExport = searchParams.get("export") === "true";

    // Permission check: View owners
    const canViewOwners = await canUser(user.id, "imoview.view_owners");
    if (!canViewOwners) {
      return NextResponse.json(
        { status: false, message: "Acesso a dados de proprietários não autorizado para seu perfil.", error: "Forbidden" },
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
          message: "Seu usuário ainda não está vinculado a um corretor captador no Imoview. Solicite ao gestor vincular seu perfil.",
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
      });
    }

    const properties = await fetchImoviewProperties({
      diasSemAtualizacao: dias,
      diasMaximos: diasMax > 0 ? diasMax : undefined,
      dataInicio,
      dataFim,
      finalidade,
      tipo,
      bairro,
      situacao,
      corretorId: activeCorretorId,
      termo,
      limite,
      origem,
      somenteComTelefone: apenasComTelefone,
    });

    // Salvar assincronamente no cache local para acesso instantaneo no Chat sem custo de API
    if (properties.length > 0) {
      upsertImoviewPropertiesContext(properties).catch((err) => {
        console.error("Erro ao salvar cache de proprietários no banco:", err);
      });
    }

    return NextResponse.json({
      status: true,
      message: `${properties.length} imóveis e proprietários encontrados no Imoview`,
      configured: true,
      data: properties,
      restrictedToBroker: canViewAllBrokers ? null : (user.imoviewCorretorNome || user.imoviewCorretorCodigo),
      canExport,
    });
  } catch (error: any) {
    console.error("Fetch Imoview properties error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar imóveis e proprietários do Imoview", error: error.message },
      { status: 500 }
    );
  }
}
