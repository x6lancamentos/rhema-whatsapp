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
  cidadeInteresse?: string;
  valorInteresse?: string;
  quartos?: string;
  vagas?: string;
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

export interface ImoviewProperty {
  codigo: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  valor: string;
  bairro: string;
  cidade: string;
  quartos?: string;
  vagas?: string;
  dataUltimaAlteracao?: string;
  diasSemAtualizacao: number;
  proprietarioNome: string;
  proprietarioTelefone: string;
  fotoPrincipal?: string;
  corretorNome?: string;
  corretorId?: string;
  situacao?: string;
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
    for (let page = 1; page <= 3; page++) {
      try {
        const u = new URL(`${cleanBase}/Atendimento/RetornarAtendimentos`);
        u.searchParams.set("numeroPagina", String(page));
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
  }

  return Array.from(brokersMap.entries())
    .map(([id, nome]) => ({
      id,
      nome,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
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

          // Extração inteligente de dados do imóvel de interesse
          const prop =
            (Array.isArray(item.imoveisvisita) && item.imoveisvisita[0]) ||
            (Array.isArray(item.imoveiscarrinho) && item.imoveiscarrinho[0]) ||
            (Array.isArray(item.imoveisproposta) && item.imoveisproposta[0]) ||
            (Array.isArray(item.imoveisnegocio) && item.imoveisnegocio[0]) ||
            item.imovel ||
            null;

          const codigoImovel = prop?.codigo ? String(prop.codigo) : (item.codigoimovel ? String(item.codigoimovel) : undefined);
          const tipoImovel = prop?.tipo || prop?.subtipo || prop?.tipoimovel || item.tipoimovel || undefined;
          const bairroInteresse = prop?.bairro || item.bairro || undefined;
          const cidadeInteresse = prop?.cidade || item.cidade || undefined;
          const valorInteresse = prop?.valor
            ? (typeof prop.valor === "number" ? `R$ ${prop.valor.toLocaleString("pt-BR")}` : String(prop.valor))
            : (item.valor ? (typeof item.valor === "number" ? `R$ ${item.valor.toLocaleString("pt-BR")}` : String(item.valor)) : undefined);
          const quartos = prop?.numeroquartos != null ? String(prop.numeroquartos) : (item.numeroquartos != null ? String(item.numeroquartos) : undefined);
          const vagas = prop?.numerovagas != null ? String(prop.numerovagas) : (item.numerovagas != null ? String(item.numerovagas) : undefined);

          allLeads.push({
            atendimentoId: String(item.codigo),
            clienteId: String(item.lead?.codigo || ""),
            clienteNome: item.lead?.nome || "Cliente",
            telefone: rawPhone,
            corretorNome: item.corretor || "Rhema Imóveis",
            corretorId: String(item.corretorcodigo || ""),
            codigoImovel,
            tipoImovel,
            bairroInteresse,
            cidadeInteresse,
            valorInteresse,
            quartos,
            vagas,
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

export async function fetchImoviewProperties(options: {
  diasSemAtualizacao?: number;
  diasMaximos?: number;
  dataInicio?: string;
  dataFim?: string;
  finalidade?: string; // "1" = Locação, "2" = Venda, "0" = Todos
  limite?: number;
  tipo?: string;
  bairro?: string;
  situacao?: string;
  corretorId?: string;
  termo?: string;
  origem?: "proprietarios" | "imoveis";
  somenteComTelefone?: boolean;
}): Promise<ImoviewProperty[]> {
  const config = await getImoviewConfig();
  if (!config.apiKey) return [];

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;
  const maxLimit = Math.min(500, options.limite ?? 100);
  const minDays = options.diasSemAtualizacao ?? 0;
  const maxDays = options.diasMaximos ?? 0;
  const startDate = options.dataInicio ? new Date(options.dataInicio) : null;
  const endDate = options.dataFim ? new Date(options.dataFim) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  // Mapear nomes de corretores para exibição
  const brokers = await fetchImoviewBrokers();
  const brokerMap = new Map<string, string>();
  for (const b of brokers) {
    brokerMap.set(b.id, b.nome);
  }

  const allProperties: ImoviewProperty[] = [];
  const now = Date.now();
  // Se corretorId for informado, a busca de captações no Imoview se dá via catálogo de Imóveis (codigocaptador)
  const origem = options.corretorId ? "imoveis" : (options.origem || "proprietarios");

  if (origem === "proprietarios") {
    // Tipos de relacionamento no Imoview:
    // 6 = Proprietário (Venda - 6.366 clientes cadastrados)
    // 2 = Locador / Proprietário (Locação - 1.149 clientes cadastrados)
    let tiposRel: number[] = [6, 2];
    if (options.finalidade === "2") tiposRel = [6];
    else if (options.finalidade === "1") tiposRel = [2];

    for (const tipoRel of tiposRel) {
      if (allProperties.length >= maxLimit) break;
      const pagesToFetch = Math.min(25, Math.ceil((maxLimit - allProperties.length) / 20) + 1);

      for (let page = 1; page <= pagesToFetch; page++) {
        if (allProperties.length >= maxLimit) break;

        try {
          const u = new URL(`${cleanBase}/Cliente/RetornarClientes`);
          u.searchParams.set("numeroPagina", String(page));
          u.searchParams.set("numeroRegistros", "20"); // Imoview limit is strictly 20!
          u.searchParams.set("tipoRelacionamento", String(tipoRel));

          const res = await fetch(u.toString(), {
            method: "GET",
            headers,
          });

          if (!res.ok) break;

          const data = await res.json();
          if (!data.lista || !Array.isArray(data.lista) || data.lista.length === 0) {
            break;
          }

          for (const item of data.lista) {
            const dateStr = item.dataultimaalteracao || item.datainclusao;
            const updateDate = parseBrDate(dateStr);
            const diffDays = updateDate
              ? Math.max(0, Math.floor((now - updateDate.getTime()) / (1000 * 60 * 60 * 24)))
              : 0;

            // Filtros de dias
            if (minDays > 0 && diffDays < minDays) continue;
            if (maxDays > 0 && diffDays > maxDays) continue;

            // Filtros de data específica
            if (startDate && updateDate && updateDate < startDate) continue;
            if (endDate && updateDate && updateDate > endDate) continue;

            const propNome = (item.nome || item.fantasia || "Proprietário").trim();
            // Pega o primeiro telefone válido
            const rawPhone = (
              item.telefones?.find((t: any) => t.numero && t.numero.replace(/\D/g, "").length >= 8)?.numero ||
              ""
            ).trim();

            if (options.somenteComTelefone && (!rawPhone || rawPhone.replace(/\D/g, "").length < 8)) {
              continue;
            }

            // Filtro por bairro se informado
            const itemBairro = item.enderecos?.[0]?.bairro || "";
            if (options.bairro && itemBairro && !itemBairro.toLowerCase().includes(options.bairro.toLowerCase())) {
              continue;
            }

            if (options.termo) {
              const q = options.termo.toLowerCase();
              const match =
                String(item.codigo).includes(q) ||
                propNome.toLowerCase().includes(q) ||
                rawPhone.includes(q) ||
                itemBairro.toLowerCase().includes(q);
              if (!match) continue;
            }

            const propRel = item.relacionamentos?.find((r: any) => r.proprietario !== undefined)?.proprietario || 0;
            const locRel = item.relacionamentos?.find((r: any) => r.locador !== undefined)?.locador || 0;
            const qtdImoveis = propRel || locRel || 1;
            const finalidadeNome = tipoRel === 6 ? "Venda" : "Locação";

            allProperties.push({
              codigo: String(item.codigo),
              titulo: `Proprietário (${qtdImoveis} imóvel${qtdImoveis > 1 ? "is" : ""})`,
              tipo: finalidadeNome,
              finalidade: finalidadeNome,
              valor: `${qtdImoveis} imóvel(is)`,
              bairro: itemBairro || "Santos",
              cidade: item.enderecos?.[0]?.cidade || "SP",
              dataUltimaAlteracao: dateStr || undefined,
              diasSemAtualizacao: diffDays,
              proprietarioNome: propNome,
              proprietarioTelefone: rawPhone,
            });

            if (allProperties.length >= maxLimit) break;
          }
        } catch (e: any) {
          logger.error("Imoview", `Error fetching owners page ${page}:`, e);
          break;
        }
      }
    }
  } else {
    // Origem === "imoveis" (Catálogo de Imóveis & Captações)
    const finalidades = options.finalidade && options.finalidade !== "0"
      ? [options.finalidade]
      : ["2", "1"];

    for (const fin of finalidades) {
      for (let page = 1; page <= 12; page++) {
        if (allProperties.length >= maxLimit) break;

        try {
          const bodyPayload: any = {
            numeroPagina: page,
            numeroRegistros: 20, // Imoview hard limit is 20!
            finalidade: fin,
          };

          // Filtro por corretor captador se informado
          if (options.corretorId) {
            bodyPayload.codigocaptador = Number(options.corretorId);
          }

          const res = await fetch(`${cleanBase}/Imovel/RetornarImoveis`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyPayload),
          });

          if (!res.ok) break;

          const data = await res.json();
          if (!data.lista || !Array.isArray(data.lista) || data.lista.length === 0) {
            break;
          }

          for (const item of data.lista) {
            const dateStr = item.datahoraultimaalteracao || item.datahoraultimavalidacao || item.datahoracadastro;
            const updateDate = parseBrDate(dateStr);
            const diffDays = updateDate
              ? Math.max(0, Math.floor((now - updateDate.getTime()) / (1000 * 60 * 60 * 24)))
              : 0;

            // Filtros de dias
            if (minDays > 0 && diffDays < minDays) continue;
            if (maxDays > 0 && diffDays > maxDays) continue;

            // Filtros de data específica
            if (startDate && updateDate && updateDate < startDate) continue;
            if (endDate && updateDate && updateDate > endDate) continue;

            // Filtro por tipo de imóvel
            if (options.tipo && item.tipo && !item.tipo.toLowerCase().includes(options.tipo.toLowerCase())) {
              continue;
            }

            // Filtro por bairro
            if (options.bairro && item.bairro && !item.bairro.toLowerCase().includes(options.bairro.toLowerCase())) {
              continue;
            }

            // Filtro por situação do imóvel
            if (options.situacao && item.situacao && !item.situacao.toLowerCase().includes(options.situacao.toLowerCase())) {
              continue;
            }

            const brokerNome = options.corretorId
              ? brokerMap.get(options.corretorId)
              : undefined;

            if (options.termo) {
              const q = options.termo.toLowerCase();
              const match =
                String(item.codigo).includes(q) ||
                (item.titulo || "").toLowerCase().includes(q) ||
                (item.bairro || "").toLowerCase().includes(q) ||
                (item.cidade || "").toLowerCase().includes(q) ||
                (item.tipo || "").toLowerCase().includes(q) ||
                (brokerNome && brokerNome.toLowerCase().includes(q));
              if (!match) continue;
            }

            const propNome = (
              item.proprietarios?.[0]?.nome ||
              item.proprietarios?.[0]?.proprietario ||
              item.nomeproprietario ||
              item.proprietario ||
              item.contatonome ||
              "Proprietário"
            ).trim();

            const rawPhone = (
              item.proprietarios?.[0]?.celular ||
              item.proprietarios?.[0]?.telefone ||
              item.telefoneproprietario ||
              item.celularproprietario ||
              item.celular ||
              item.telefone ||
              ""
            ).trim();

            if (options.somenteComTelefone && (!rawPhone || rawPhone.replace(/\D/g, "").length < 8)) {
              continue;
            }

            const formattedValor = item.valor
              ? (typeof item.valor === "number" ? `R$ ${item.valor.toLocaleString("pt-BR")}` : String(item.valor))
              : "Sob Consulta";

            allProperties.push({
              codigo: String(item.codigo),
              titulo: item.titulo || `${item.tipo || "Imóvel"} em ${item.bairro || "Santos"}`,
              tipo: item.tipo || "Imóvel",
              finalidade: item.finalidade === "2" || item.finalidade === 2 ? "Venda" : "Locação",
              valor: formattedValor,
              bairro: item.bairro || "",
              cidade: item.cidade || "",
              quartos: item.numeroquartos != null ? String(item.numeroquartos) : undefined,
              vagas: item.numerovagas != null ? String(item.numerovagas) : undefined,
              dataUltimaAlteracao: dateStr || undefined,
              diasSemAtualizacao: diffDays,
              proprietarioNome: propNome,
              proprietarioTelefone: rawPhone,
              fotoPrincipal: item.urlfotoprincipal || item.urlfotoprincipalm || undefined,
              corretorId: options.corretorId || undefined,
              corretorNome: brokerNome || (item.captadores?.[0]?.nome || undefined),
              situacao: item.situacao || undefined,
            });

            if (allProperties.length >= maxLimit) break;
          }
        } catch (e: any) {
          logger.error("Imoview", `Error fetching properties page ${page}:`, e);
          break;
        }
      }
    }
  }

  // Sort by most days without update first
  allProperties.sort((a, b) => b.diasSemAtualizacao - a.diasSemAtualizacao);

  return allProperties;
}
