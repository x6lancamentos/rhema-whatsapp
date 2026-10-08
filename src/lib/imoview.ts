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
  finalidade?: string;
  funil?: string;
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
    "Accept": "application/json",
    "chave": apiKey.trim(),
  };
}

// Helper to parse Brazilian date format (DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm)
export function parseBrDate(str?: string): Date | null {
  if (!str) return null;
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, day, month, year, hours, minutes, seconds] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours || 0),
      Number(minutes || 0),
      Number(seconds || 0)
    );
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export async function testImoviewConnection(
  apiKey: string,
  baseUrl = "https://api.imoview.com.br"
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, message: "Chave de API do Imoview não informada." };
  }

  const cleanBase = baseUrl.replace(/\/$/, "");
  const headers = buildHeaders(apiKey);

  try {
    const u = new URL(`${cleanBase}/Atendimento/RetornarAtendimentos`);
    u.searchParams.set("numeroPagina", "1");
    u.searchParams.set("numeroRegistros", "1");
    u.searchParams.set("finalidade", "2"); // Venda
    u.searchParams.set("fase", "0");
    u.searchParams.set("situacao", "1");

    const res = await fetch(u.toString(), {
      method: "GET",
      headers,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        message: `Conexão estabelecida com sucesso com a API do Imoview! (${data.quantidade ?? 0} atendimentos ativos no CRM)`,
        data,
      };
    } else if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: `Chave de API inválida ou sem permissão de acesso (HTTP ${res.status}). Verifique a chave 'chave'.`,
      };
    } else {
      return {
        success: false,
        message: `Servidor do Imoview retornou código HTTP ${res.status}. Verifique se a URL está correta.`,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      message: `Erro ao conectar com a API do Imoview: ${e.message}`,
    };
  }
}

export async function fetchImoviewBrokers(): Promise<ImoviewBroker[]> {
  const config = await getImoviewConfig();
  if (!config.apiKey) return [];

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;
  const brokersMap = new Map<string, string>();

  // Fetch recent pages to extract active brokers
  for (const finalidade of ["2", "1"]) {
    try {
      const u = new URL(`${cleanBase}/Atendimento/RetornarAtendimentos`);
      u.searchParams.set("numeroPagina", "1");
      u.searchParams.set("numeroRegistros", "20");
      u.searchParams.set("finalidade", finalidade);
      u.searchParams.set("fase", "0");
      u.searchParams.set("situacao", "1");

      const res = await fetch(u.toString(), { method: "GET", headers });
      if (res.ok) {
        const data = await res.json();
        if (data.lista && Array.isArray(data.lista)) {
          for (const item of data.lista) {
            if (item.corretor && item.corretorcodigo) {
              brokersMap.set(String(item.corretorcodigo), String(item.corretor).trim());
            }
          }
        }
      }
    } catch {
      // Continue
    }
  }

  return Array.from(brokersMap.entries()).map(([id, nome]) => ({
    id,
    nome,
  }));
}

export async function fetchImoviewStalledLeads(options: {
  diasSemContato?: number;
  corretorId?: string;
  statusId?: string;
  limite?: number;
}): Promise<ImoviewLead[]> {
  const config = await getImoviewConfig();
  const minDays = options.diasSemContato ?? 7;
  const maxLimit = options.limite ?? 150;

  if (!config.apiKey) {
    return [];
  }

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;
  const allLeads: ImoviewLead[] = [];
  const now = Date.now();

  // Query both Venda (2) and Aluguel (1)
  for (const finalidade of ["2", "1"]) {
    // Up to 6 pages (120 records per finality)
    for (let page = 1; page <= 6; page++) {
      if (allLeads.length >= maxLimit) break;

      try {
        const u = new URL(`${cleanBase}/Atendimento/RetornarAtendimentos`);
        u.searchParams.set("numeroPagina", String(page));
        u.searchParams.set("numeroRegistros", "20");
        u.searchParams.set("finalidade", finalidade);
        u.searchParams.set("fase", "0"); // All phases
        u.searchParams.set("situacao", options.statusId || "1"); // 1 = Em atendimento
        if (options.corretorId) {
          u.searchParams.set("codigoCorretor", options.corretorId);
        }

        const res = await fetch(u.toString(), { method: "GET", headers });
        if (!res.ok) break;

        const data = await res.json();
        if (!data.lista || !Array.isArray(data.lista) || data.lista.length === 0) {
          break;
        }

        for (const item of data.lista) {
          const rawPhone = item.lead?.telefone1 || item.lead?.telefone2 || "";
          const cleanPhone = rawPhone.replace(/\D/g, "");
          if (!cleanPhone || cleanPhone.length < 8) continue;

          // Parse contact date
          const dateStr = item.datahoraultimainteracao || item.datahorainclusao;
          const contactDate = parseBrDate(dateStr);
          const diffDays = contactDate
            ? Math.max(0, Math.floor((now - contactDate.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          // Filter by minimum stalled days
          if (diffDays < minDays) continue;

          // Filter by broker if specified
          if (options.corretorId && String(item.corretorcodigo) !== options.corretorId) {
            continue;
          }

          const ultimoHistorico =
            item.interacoes && item.interacoes.length > 0
              ? item.interacoes[0].descricao || item.interacoes[0].texto || "Interação registrada"
              : "Sem histórico registrado";

          allLeads.push({
            atendimentoId: String(item.codigo),
            clienteId: String(item.lead?.codigo || ""),
            clienteNome: item.lead?.nome || "Cliente",
            telefone: rawPhone,
            corretorNome: item.corretor || "Rhema Imóveis",
            corretorId: String(item.corretorcodigo || ""),
            finalidade: item.finalidade || (finalidade === "2" ? "Venda" : "Aluguel"),
            funil: item.funil || "Atendimento",
            diasSemContato: diffDays,
            dataUltimoContato: dateStr || (contactDate ? contactDate.toISOString() : undefined),
            ultimoHistorico,
            statusAtendimento: item.situacao || "Em atendimento",
          });

          if (allLeads.length >= maxLimit) break;
        }
      } catch (e: any) {
        logger.error("Imoview", `Error fetching page ${page} of finalidade ${finalidade}:`, e);
        break;
      }
    }
  }

  // Sort by most days without contact first
  allLeads.sort((a, b) => b.diasSemContato - a.diasSemContato);

  return allLeads;
}

export async function recordImoviewInteraction(
  atendimentoId: string,
  historicoTexto: string,
  tipo = "WhatsApp Auto"
): Promise<boolean> {
  const config = await getImoviewConfig();
  if (!config.apiKey || !config.autoRecordInteraction) return false;

  const cleanBase = config.baseUrl;
  const headers = {
    ...buildHeaders(config.apiKey),
    "Content-Type": "application/json",
  };

  try {
    const u = new URL(`${cleanBase}/Atendimento/App_IncluirInteracao`);
    u.searchParams.set("codigoAtendimento", atendimentoId);
    u.searchParams.set("descricao", `[${tipo}] ${historicoTexto}`);
    u.searchParams.set("codigoUsuario", "1");

    const res = await fetch(u.toString(), {
      method: "POST",
      headers,
    });

    if (res.ok) {
      logger.info("Imoview", `History recorded successfully for atendimento #${atendimentoId}`);
      return true;
    }
  } catch (e) {
    logger.error("Imoview", `Error recording interaction for #${atendimentoId}:`, e);
  }

  return false;
}
