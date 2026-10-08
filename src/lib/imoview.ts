import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface ImoviewLead {
  atendimentoId: string;
  clienteId?: string;
  clienteNome: string;
  telefone: string;
  corretorNome?: string;
  corretorId?: string;
  codigoImovel?: string;
  tipoImovel?: string;
  bairroInteresse?: string;
  valorInteresse?: string;
  diasSemContato: number;
  ultimoHistorico?: string;
  dataUltimoContato?: string;
  statusAtendimento?: string;
}

export interface ImoviewBroker {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
}

export async function getImoviewConfig() {
  try {
    const config = await prisma.imoviewConfig.findUnique({
      where: { id: "default" },
    });

    return {
      apiKey: config?.apiKey || process.env.IMOVIEW_API_KEY || "",
      baseUrl: (config?.baseUrl || process.env.IMOVIEW_BASE_URL || "https://api.imoview.com.br").replace(/\/$/, ""),
      isActive: config?.isActive ?? true,
      autoRecordInteraction: config?.autoRecordInteraction ?? true,
      autoRecordResponse: config?.autoRecordResponse ?? true,
      autoNotifyBroker: config?.autoNotifyBroker ?? true,
    };
  } catch {
    return {
      apiKey: process.env.IMOVIEW_API_KEY || "",
      baseUrl: (process.env.IMOVIEW_BASE_URL || "https://api.imoview.com.br").replace(/\/$/, ""),
      isActive: true,
      autoRecordInteraction: true,
      autoRecordResponse: true,
      autoNotifyBroker: true,
    };
  }
}

// Universal Software / Imoview API standard headers
function buildHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "chave": apiKey,
    "Authorization": `Bearer ${apiKey}`,
    "token": apiKey,
  };
}

export async function testImoviewConnection(apiKey: string, baseUrl = "https://api.imoview.com.br"): Promise<{ success: boolean; message: string; data?: any }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, message: "Chave de API do Imoview não informada." };
  }

  const cleanBase = baseUrl.replace(/\/$/, "");
  const headers = buildHeaders(apiKey.trim());

  // Test standard Imoview endpoints (corretor or atendimento)
  const candidateEndpoints = [
    `${cleanBase}/v1/corretor/retornar`,
    `${cleanBase}/v1/corretores`,
    `${cleanBase}/v1/atendimento/retornar?limite=1`,
    `${cleanBase}/corretores`,
    `${cleanBase}/atendimentos`,
  ];

  for (const url of candidateEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return {
          success: true,
          message: "Conexão estabelecida com sucesso com a API do Imoview!",
          data: json,
        };
      } else if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          message: `Chave de API inválida ou sem permissão (HTTP ${res.status}).`,
        };
      }
    } catch (e: any) {
      // Continue to next candidate endpoint
    }
  }

  return {
    success: false,
    message: "Não foi possível validar a chave nos servidores do Imoview. Verifique a URL e sua chave de acesso.",
  };
}

export async function fetchImoviewBrokers(): Promise<ImoviewBroker[]> {
  const config = await getImoviewConfig();
  if (!config.apiKey) return [];

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;

  const endpoints = [
    `${cleanBase}/v1/corretor/retornar`,
    `${cleanBase}/v1/corretores`,
    `${cleanBase}/corretores`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: "GET", headers });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.corretores || json.data || json.lista || [];
        return list.map((item: any) => ({
          id: String(item.codigo || item.id || item.codcorretor || ""),
          nome: item.nome || item.nomecorretor || "Corretor",
          email: item.email || "",
          telefone: item.celular || item.telefone || "",
        }));
      }
    } catch {
      // ignore
    }
  }

  return [];
}

export async function fetchImoviewStalledLeads(options: {
  diasSemContato?: number;
  corretorId?: string;
  statusId?: string;
  limite?: number;
}): Promise<ImoviewLead[]> {
  const config = await getImoviewConfig();
  const minDays = options.diasSemContato ?? 7;
  const limite = options.limite ?? 50;

  if (!config.apiKey) {
    return [];
  }

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;

  // Query Imoview Atendimentos
  const params = new URLSearchParams();
  params.set("limite", String(limite));
  if (options.corretorId) params.set("codcorretor", options.corretorId);
  if (options.statusId) params.set("codsituacao", options.statusId);

  const endpoints = [
    `${cleanBase}/v1/atendimento/retornar?${params.toString()}`,
    `${cleanBase}/v1/atendimentos?${params.toString()}`,
    `${cleanBase}/atendimentos?${params.toString()}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: "GET", headers });
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json)
          ? json
          : json.atendimentos || json.data || json.lista || [];

        const now = Date.now();

        const filtered: ImoviewLead[] = rawList
          .map((item: any) => {
            const dataContatoRaw =
              item.data_ultimo_historico ||
              item.dataultimocontato ||
              item.data_alteracao ||
              item.data_cadastro ||
              item.data;

            const contactDate = dataContatoRaw ? new Date(dataContatoRaw) : new Date();
            const diffDays = Math.max(
              0,
              Math.floor((now - contactDate.getTime()) / (1000 * 60 * 60 * 24))
            );

            const telefone =
              item.cliente_celular ||
              item.celular ||
              item.telefone ||
              item.cliente_telefone ||
              "";

            return {
              atendimentoId: String(item.codigo || item.id || item.codatendimento || ""),
              clienteId: String(item.codcliente || item.cliente_codigo || ""),
              clienteNome: item.cliente_nome || item.nome_cliente || item.nome || "Cliente",
              telefone,
              corretorNome: item.corretor_nome || item.nome_corretor || item.corretor || "Rhema Imóveis",
              corretorId: String(item.codcorretor || item.corretor_codigo || ""),
              codigoImovel: item.codimovel || item.imovel_codigo || item.codigo_imovel || "",
              tipoImovel: item.tipo_imovel || item.imovel_tipo || "Imóvel",
              bairroInteresse: item.bairro || item.imovel_bairro || "",
              valorInteresse: item.valor ? `R$ ${item.valor}` : "",
              diasSemContato: diffDays,
              ultimoHistorico: item.ultimo_historico || item.historico || "Sem histórico recente",
              dataUltimoContato: contactDate.toISOString(),
              statusAtendimento: item.situacao || item.status || "Em Aberto",
            };
          })
          .filter((lead: ImoviewLead) => {
            return (
              lead.telefone &&
              lead.telefone.replace(/\D/g, "").length >= 8 &&
              lead.diasSemContato >= minDays
            );
          });

        return filtered;
      }
    } catch (e) {
      logger.error("Imoview", `Error fetching leads from ${url}`, e);
    }
  }

  return [];
}

export async function recordImoviewInteraction(
  atendimentoId: string,
  historicoTexto: string,
  tipo = "WhatsApp Auto"
): Promise<boolean> {
  const config = await getImoviewConfig();
  if (!config.apiKey || !config.autoRecordInteraction) return false;

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;

  const endpoints = [
    `${cleanBase}/v1/atendimento/gravarhistorico`,
    `${cleanBase}/v1/atendimento/inserirhistorico`,
    `${cleanBase}/v1/atendimento/historico`,
    `${cleanBase}/atendimentos/${atendimentoId}/historico`,
  ];

  const payload = {
    codatendimento: atendimentoId,
    atendimentoId,
    descricao: `[${tipo}] ${historicoTexto}`,
    historico: `[${tipo}] ${historicoTexto}`,
    data: new Date().toISOString(),
  };

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        logger.info("Imoview", `History recorded for atendimento ${atendimentoId}`);
        return true;
      }
    } catch (e) {
      logger.error("Imoview", `Error recording history at ${url}`, e);
    }
  }

  return false;
}
