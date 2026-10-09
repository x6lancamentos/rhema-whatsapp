import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { fetchImoviewProperties, getImoviewConfig } from "@/lib/imoview";

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
    const corretorId = searchParams.get("corretorId") || undefined;
    const termo = searchParams.get("termo") || undefined;
    const limite = parseInt(searchParams.get("limite") || "100", 10);
    const origem = (searchParams.get("origem") as "proprietarios" | "imoveis") || "proprietarios";
    const apenasComTelefone = searchParams.get("apenasComTelefone") === "true";

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
      corretorId,
      termo,
      limite,
      origem,
      somenteComTelefone: apenasComTelefone,
    });

    return NextResponse.json({
      status: true,
      message: `${properties.length} imóveis e proprietários encontrados no Imoview`,
      configured: true,
      data: properties,
    });
  } catch (error: any) {
    console.error("Fetch Imoview properties error:", error);
    return NextResponse.json(
      { status: false, message: "Erro ao buscar imóveis e proprietários do Imoview", error: error.message },
      { status: 500 }
    );
  }
}
