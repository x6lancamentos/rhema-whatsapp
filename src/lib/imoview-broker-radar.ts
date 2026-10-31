import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getImoviewConfig, parseBrDate, formatarMoeda, ImoviewBroker } from "@/lib/imoview";

export interface RadarProperty {
  codigo: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  valor: string;
  valorNumerico: number;
  valorCondominio?: string;
  valorIptu?: string;
  bairro: string;
  cidade: string;
  quartos?: number;
  vagas?: number;
  suites?: number;
  dataCadastro?: string;
  dataUltimaAlteracao?: string;
  diasNoEstoque: number;
  captadorNome?: string;
  captadorCodigo?: string;
  fotoPrincipal?: string;
  linkImovel?: string;
  situacao?: string;
  descricao?: string;
  caracteristicas?: string[];
  hasElevador?: boolean;
  hasEscada?: boolean;
  hasVagaDemarcada?: boolean;
  hasVarandaGourmet?: boolean;
  hasVistaMar?: boolean;
  hasReforma?: boolean;
}

export interface RadarLead {
  atendimentoId: string;
  clienteId?: string;
  clienteNome: string;
  telefone: string;
  corretorNome?: string;
  corretorCodigo?: string;
  tipoImovel?: string;
  bairroInteresse?: string;
  cidadeInteresse?: string;
  valorInteresse?: string;
  valorNumerico?: number;
  quartos?: number;
  vagas?: number;
  termometro?: string;
  diasSemContato: number;
  dataUltimoContato?: string;
  ultimoHistorico?: string;
  interacoesTexto?: string;
  imovelOrigemCodigo?: string;
  imovelOrigemTitulo?: string;
  imovelOrigemBairro?: string;
  imovelOrigemTipo?: string;
  imovelOrigemValor?: number;
  imovelOrigemQuartos?: number;
  statusAtendimento?: string;
  temVisitaAgendada?: boolean;
  temProposta?: boolean;
  exigeElevador?: boolean;
  exigeVagaFixa?: boolean;
  querVaranda?: boolean;
  querVistaMar?: boolean;
}

export interface RadarMatch {
  id: string;
  score: number; // 0 to 100
  reasons: string[];
  property: RadarProperty;
  lead: RadarLead;
  corretorNome: string;
  corretorCodigo: string;
}

export interface BrokerCadenceItem {
  corretorCodigo: string;
  corretorNome: string;
  corretorTelefone?: string;
  atendimentosAtivos: number;
  atividadesVencidas: number;
  atividadesHoje: number;
  atividadesFuturas: number;
  atividadesConcluidas: number;
  leadsSemContatoMais7Dias: number;
  statusSla: "CRITICO" | "ATENCAO" | "EM_DIA";
  ultimasAtividades: Array<{
    codigo: number;
    titulo: string;
    tipo: string;
    dataHora: string;
    leadNome?: string;
    imovelCodigo?: number;
    realizada: boolean;
    atrasada: boolean;
  }>;
}

function buildHeaders(apiKey: string, includeUserAccess = false) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    chave: apiKey.trim(),
  };
  if (includeUserAccess) {
    headers.codigoacesso = process.env.IMOVIEW_USER_CODE || "8";
  }
  return headers;
}

// ============================================================================
// CACHE EM MEMÓRIA DE ALTA VELOCIDADE (STALE-WHILE-REVALIDATE — TTL 5 MIN)
// Evita travamentos na tela de Match (broker-radar) eliminando 22+ chamadas
// HTTP sequenciais repetidas a cada mudança de filtro.
// ============================================================================
interface BrokerRadarCacheStore {
  stockProperties: { data: RadarProperty[]; timestamp: number } | null;
  activeLeads: { data: RadarLead[]; timestamp: number } | null;
  cadenceData: { data: BrokerCadenceItem[]; timestamp: number } | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const globalForRadar = globalThis as unknown as {
  __rhemaBrokerRadarCache?: BrokerRadarCacheStore;
};

if (!globalForRadar.__rhemaBrokerRadarCache) {
  globalForRadar.__rhemaBrokerRadarCache = {
    stockProperties: null,
    activeLeads: null,
    cadenceData: null,
  };
}

export function invalidateBrokerRadarCache() {
  globalForRadar.__rhemaBrokerRadarCache = {
    stockProperties: null,
    activeLeads: null,
    cadenceData: null,
  };
}

// Extrai valor numérico de strings formatadas (R$ 850.000,00 ou 850000)
export function parseCurrencyNumber(val: any): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  // Trata formato brasileiro 850.000,00
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }
  return parseFloat(cleaned) || 0;
}

/**
 * 1. Busca os imóveis mais recentes no estoque da Rhema via API do Imoview
 */
export async function fetchRecentStockProperties(options: {
  diasMaximos?: number; // Ex: 7 dias (default), 15, 30 ou 0 para todos
  finalidade?: string; // "2" = Venda, "1" = Locação, "0" = Todos
  limite?: number;
  bairro?: string;
  tipo?: string;
  forceRefresh?: boolean;
}): Promise<RadarProperty[]> {
  const maxLimit = options.limite ?? 80;
  const diasMaximos = options.diasMaximos ?? 7;
  const cache = globalForRadar.__rhemaBrokerRadarCache!;
  const now = Date.now();

  let rawProperties: RadarProperty[] = [];

  if (
    !options.forceRefresh &&
    cache.stockProperties &&
    now - cache.stockProperties.timestamp < CACHE_TTL_MS
  ) {
    rawProperties = cache.stockProperties.data;
  } else {
    const config = await getImoviewConfig();
    if (!config.apiKey) return [];

    const headers = buildHeaders(config.apiKey);
    const cleanBase = config.baseUrl;
    const fetchedProperties: RadarProperty[] = [];

    // Busca paralela das páginas de Venda ("2") e Locação ("1") para reduzir de ~8s para ~1.1s
    const tasks: Array<{ fin: string; page: number }> = [
      { fin: "2", page: 1 },
      { fin: "2", page: 2 },
      { fin: "2", page: 3 },
      { fin: "2", page: 4 },
      { fin: "1", page: 1 },
      { fin: "1", page: 2 },
    ];

    const pageResults = await Promise.all(
      tasks.map(async ({ fin, page }) => {
        try {
          const res = await fetch(`${cleanBase}/Imovel/RetornarImoveis`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              numeroPagina: page,
              numeroRegistros: 20,
              finalidade: fin,
              ordenacao: "-1",
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return { fin, lista: [] };
          const data = await res.json();
          return { fin, lista: Array.isArray(data.lista) ? data.lista : [] };
        } catch (err: any) {
          logger.error("BrokerRadar", `Error fetching stock properties (${fin} p${page}):`, err);
          return { fin, lista: [] };
        }
      })
    );

    const seenCodes = new Set<string>();
    for (const { fin, lista } of pageResults) {
      for (const item of lista) {
        const codigoStr = String(item.codigo);
        if (seenCodes.has(codigoStr)) continue;
        seenCodes.add(codigoStr);

        const dateStr = item.datahoraultimavalidacao || item.datahoracadastro || item.datahoraultimaalteracao;
        const propDate = parseBrDate(dateStr);
        const diffDays = propDate
          ? Math.max(0, Math.floor((now - propDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        // Armazena até 45 dias no cache para permitir troca instantânea entre 3d, 7d, 15d e 30d
        if (diffDays > 45) continue;

        const rawValor = item.valor || 0;
        const valorNum = parseCurrencyNumber(rawValor);
        const formattedValor = valorNum > 0 ? formatarMoeda(valorNum) || `R$ ${valorNum.toLocaleString("pt-BR")}` : "Sob Consulta";
        const formattedCond = formatarMoeda(item.valorcondominio);
        const formattedIptu = formatarMoeda(item.valoriptu);

        const captadorNome = item.captadores?.[0]?.nome || item.nomecaptador || item.corretornome || "Rhema Imóveis";
        const captadorCodigo = item.captadores?.[0]?.codigo
          ? String(item.captadores[0].codigo)
          : item.codigocaptador
            ? String(item.codigocaptador)
            : undefined;

        const descricaoRaw = String(item.descricao || item.observacao || item.observacoes || "").trim();
        const caracsRaw = Array.isArray(item.caracteristicas)
          ? item.caracteristicas.map((c: any) => String(c.nome || c).trim())
          : (item.caracteristicas ? [String(item.caracteristicas)] : []);
        const fullDescLower = `${item.titulo || ""} ${descricaoRaw} ${caracsRaw.join(" ")}`.toLowerCase();

        const hasElevador = /elevador|elevadores/i.test(fullDescLower);
        const hasEscada = /sem elevador|de escada|prédio de escada|3 andares sem/i.test(fullDescLower);
        const hasVagaDemarcada = /demarcad|privativ|fechad|garagem fechada/i.test(fullDescLower);
        const hasVarandaGourmet = /varanda gourmet|sacada gourmet|churrasqueira/i.test(fullDescLower);
        const hasVistaMar = /vista ao mar|vista mar|frente mar|pé na areia|quadra da praia/i.test(fullDescLower);
        const hasReforma = /reformad|modernizad|porteira fechada|planejados|fino acabamento/i.test(fullDescLower);

        fetchedProperties.push({
          codigo: codigoStr,
          titulo: item.titulo || `${item.tipo || "Imóvel"} em ${item.bairro || "Santos"}`,
          tipo: item.tipo || "Apartamento",
          finalidade: fin === "2" ? "Venda" : "Locação",
          valor: formattedValor,
          valorNumerico: valorNum,
          valorCondominio: formattedCond,
          valorIptu: formattedIptu,
          bairro: item.bairro || "Santos",
          cidade: item.cidade || "Santos",
          quartos: item.numeroquartos != null ? Number(item.numeroquartos) : undefined,
          vagas: item.numerovagas != null ? Number(item.numerovagas) : undefined,
          suites: item.numerosuites != null ? Number(item.numerosuites) : undefined,
          dataCadastro: item.datahoracadastro || undefined,
          dataUltimaAlteracao: dateStr || undefined,
          diasNoEstoque: diffDays,
          captadorNome,
          captadorCodigo,
          fotoPrincipal: item.urlfotoprincipal || item.urlfotoprincipalm || undefined,
          linkImovel: `https://www.rhemaimoveis.com.br/imovel/detalhes/${item.codigo}`,
          situacao: item.situacao || "Disponível",
          descricao: descricaoRaw,
          caracteristicas: caracsRaw,
          hasElevador,
          hasEscada,
          hasVagaDemarcada,
          hasVarandaGourmet,
          hasVistaMar,
          hasReforma,
        });
      }
    }

    fetchedProperties.sort((a, b) => a.diasNoEstoque - b.diasNoEstoque);
    cache.stockProperties = { data: fetchedProperties, timestamp: now };
    rawProperties = fetchedProperties;
  }

  // Filtragem ultrarrápida em memória (< 1ms)
  return rawProperties
    .filter((p) => {
      if (diasMaximos > 0 && p.diasNoEstoque > diasMaximos) return false;
      if (options.finalidade && options.finalidade !== "0") {
        const targetFin = options.finalidade === "2" ? "Venda" : "Locação";
        if (p.finalidade !== targetFin) return false;
      }
      if (options.bairro && !p.bairro.toLowerCase().includes(options.bairro.toLowerCase())) {
        return false;
      }
      if (options.tipo && !p.tipo.toLowerCase().includes(options.tipo.toLowerCase())) {
        return false;
      }
      return true;
    })
    .slice(0, maxLimit);
}

/**
 * 2. Busca leads quentes ou pipeline em andamento via API do Imoview
 *    Com paralelismo + cache em memória (TTL 5 min).
 */
export async function fetchHotLeadsForRadar(options: {
  mode?: "hot_7days" | "all_active"; // Padrão: hot_7days
  corretorCodigo?: string;
  limite?: number;
  forceRefresh?: boolean;
}): Promise<RadarLead[]> {
  const maxLimit = options.limite ?? 150;
  const isHotOnly = options.mode !== "all_active";
  const cache = globalForRadar.__rhemaBrokerRadarCache!;
  const now = Date.now();

  let rawLeads: RadarLead[] = [];

  if (
    !options.forceRefresh &&
    cache.activeLeads &&
    now - cache.activeLeads.timestamp < CACHE_TTL_MS
  ) {
    rawLeads = cache.activeLeads.data;
  } else {
    const config = await getImoviewConfig();
    if (!config.apiKey) return [];

    const headers = buildHeaders(config.apiKey, true);
    const cleanBase = config.baseUrl;
    const fetchedLeads: RadarLead[] = [];

    // Busca paralela das páginas de Venda ("2") e Locação ("1")
    const tasks: Array<{ finalidade: string; page: number }> = [
      { finalidade: "2", page: 1 },
      { finalidade: "2", page: 2 },
      { finalidade: "2", page: 3 },
      { finalidade: "2", page: 4 },
      { finalidade: "1", page: 1 },
      { finalidade: "1", page: 2 },
    ];

    const pageResults = await Promise.all(
      tasks.map(async ({ finalidade, page }) => {
        try {
          const u = new URL(`${cleanBase}/Atendimento/RetornarAtendimentos`);
          u.searchParams.set("numeroPagina", String(page));
          u.searchParams.set("numeroRegistros", "20");
          u.searchParams.set("finalidade", finalidade);
          u.searchParams.set("fase", "0");
          u.searchParams.set("situacao", "1");

          const res = await fetch(u.toString(), {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data.lista) ? data.lista : [];
        } catch (err: any) {
          logger.error("BrokerRadar", `Error fetching leads (${finalidade} p${page}):`, err);
          return [];
        }
      })
    );

    const seenIds = new Set<string>();
    for (const lista of pageResults) {
      for (const item of lista) {
        const atId = String(item.codigo);
        if (seenIds.has(atId)) continue;

        const rawPhone = item.lead?.telefone1 || item.lead?.telefone2 || "";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 8) continue;
        seenIds.add(atId);

        const dateStr = item.datahoraultimainteracao || item.datahorainclusao;
        const contactDate = parseBrDate(dateStr);
        const diffDays = contactDate
          ? Math.max(0, Math.floor((now - contactDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        const prop =
          (Array.isArray(item.imoveisvisita) && item.imoveisvisita[0]) ||
          (Array.isArray(item.imoveiscarrinho) && item.imoveiscarrinho[0]) ||
          (Array.isArray(item.imoveisproposta) && item.imoveisproposta[0]) ||
          item.imovel ||
          null;

        const tipoImovel = prop?.tipo || prop?.subtipo || prop?.tipoimovel || item.tipoimovel || undefined;
        const bairroInteresse = prop?.bairro || item.bairro || undefined;
        const cidadeInteresse = prop?.cidade || item.cidade || "Santos";
        const rawValor = prop?.valor || item.valor || undefined;
        const valorNumerico = rawValor ? parseCurrencyNumber(rawValor) : undefined;
        const valorInteresse = valorNumerico ? formatarMoeda(valorNumerico) : rawValor ? String(rawValor) : undefined;
        const quartos =
          prop?.numeroquartos != null
            ? Number(prop.numeroquartos)
            : item.numeroquartos != null
              ? Number(item.numeroquartos)
              : undefined;
        const vagas =
          prop?.numerovagas != null
            ? Number(prop.numerovagas)
            : item.numerovagas != null
              ? Number(item.numerovagas)
              : undefined;

        const temVisita = Array.isArray(item.imoveisvisita) && item.imoveisvisita.length > 0;
        const temProposta = Array.isArray(item.imoveisproposta) && item.imoveisproposta.length > 0;

        const ultimoHistorico =
          item.interacoes && item.interacoes.length > 0
            ? item.interacoes[0].descricao || item.interacoes[0].texto || "Interação no CRM"
            : "Sem histórico";

        const interacoesTexto = Array.isArray(item.interacoes)
          ? item.interacoes.map((i: any) => i.descricao || i.texto || "").filter(Boolean).join(" | ")
          : "";

        const fullLeadText = `${item.situacao || ""} ${item.tipoimovel || ""} ${item.bairro || ""} ${ultimoHistorico} ${interacoesTexto}`.toLowerCase();

        const exigeElevador = /elevador|não pode escada|nao pode escada|idoso|joelho|sem escada/i.test(fullLeadText);
        const exigeVagaFixa = /vaga demarcada|garagem demarcada|garagem fechada|vaga privativa|2 vagas|duas vagas/i.test(fullLeadText);
        const querVaranda = /varanda|sacada|gourmet|churrasqueira/i.test(fullLeadText);
        const querVistaMar = /vista mar|frente mar|pé na areia|quadra da praia/i.test(fullLeadText);

        fetchedLeads.push({
          atendimentoId: atId,
          clienteId: item.lead?.codigo ? String(item.lead.codigo) : undefined,
          clienteNome: (item.lead?.nome || "Cliente").trim(),
          telefone: rawPhone,
          corretorNome: (item.corretor || "Corretor Rhema").trim(),
          corretorCodigo: item.corretorcodigo ? String(item.corretorcodigo) : "",
          tipoImovel,
          bairroInteresse,
          cidadeInteresse,
          valorInteresse,
          valorNumerico,
          quartos,
          vagas,
          termometro: item.termometro || (temProposta ? "Quente" : temVisita ? "Morno" : "Indefinido"),
          diasSemContato: diffDays,
          dataUltimoContato: dateStr,
          ultimoHistorico,
          interacoesTexto,
          imovelOrigemCodigo: prop?.codigo ? String(prop.codigo) : undefined,
          imovelOrigemTitulo: prop?.titulo || undefined,
          imovelOrigemBairro: prop?.bairro || undefined,
          imovelOrigemTipo: prop?.tipo || prop?.subtipo || undefined,
          imovelOrigemValor: prop?.valor ? parseCurrencyNumber(prop.valor) : undefined,
          imovelOrigemQuartos: prop?.numeroquartos != null ? Number(prop.numeroquartos) : undefined,
          statusAtendimento: item.situacao || "Em atendimento",
          temVisitaAgendada: temVisita,
          temProposta,
          exigeElevador,
          exigeVagaFixa,
          querVaranda,
          querVistaMar,
        });
      }
    }

    fetchedLeads.sort((a, b) => a.diasSemContato - b.diasSemContato);
    cache.activeLeads = { data: fetchedLeads, timestamp: now };
    rawLeads = fetchedLeads;
  }

  return rawLeads
    .filter((l) => {
      if (isHotOnly && l.diasSemContato > 7) return false;
      if (options.corretorCodigo && l.corretorCodigo !== options.corretorCodigo) return false;
      return true;
    })
    .slice(0, maxLimit);
}

/**
 * 3. Algoritmo de Combinações Inteligentes (Match Semântico em 3 Camadas & Imóvel-Âncora)
 *    Elimina falsos positivos lendo a descrição dos imóveis, aplicando vetos de incompatibilidade
 *    (ex: escada vs elevador) e clonando o perfil do imóvel do anúncio de entrada do lead.
 */
export function computeStockLeadMatches(
  properties: RadarProperty[],
  leads: RadarLead[]
): RadarMatch[] {
  const matches: RadarMatch[] = [];

  for (const property of properties) {
    for (const lead of leads) {
      // -------------------------------------------------------------
      // REGRA DE VETO 1: Incompatibilidade de Acesso (Escada vs Elevador)
      // -------------------------------------------------------------
      if (lead.exigeElevador && property.hasEscada) {
        // Veto total: cliente com joelho/idoso/exigência de elevador não aceita prédio de escada
        continue;
      }

      // -------------------------------------------------------------
      // RESOLVER CAMPOS VIA IMÓVEL-ÂNCORA (Caso o corretor não tenha preenchido o CRM)
      // -------------------------------------------------------------
      const bairroAlvo = lead.bairroInteresse || lead.imovelOrigemBairro;
      const tipoAlvo = lead.tipoImovel || lead.imovelOrigemTipo;
      const valorAlvo = lead.valorNumerico || lead.imovelOrigemValor;
      const quartosAlvo = lead.quartos || lead.imovelOrigemQuartos;

      const usouAnchor = !lead.bairroInteresse && Boolean(lead.imovelOrigemBairro);

      let score = 40; // Base score
      const reasons: string[] = [];

      if (usouAnchor && lead.imovelOrigemCodigo) {
        reasons.push(`Similar ao imóvel do anúncio de entrada #${lead.imovelOrigemCodigo}`);
      }

      // -------------------------------------------------------------
      // CAMADA 1: Compatibilidade de Bairro
      // -------------------------------------------------------------
      if (property.bairro && bairroAlvo) {
        const pBairro = property.bairro.toLowerCase().trim();
        const lBairro = bairroAlvo.toLowerCase().trim();

        if (pBairro === lBairro || pBairro.includes(lBairro) || lBairro.includes(pBairro)) {
          score += 25;
          reasons.push(`Bairro exato: ${property.bairro}`);
        } else {
          // Bairros nobres vizinhos na Orla de Santos
          const orlaSantos = ["gonzaga", "boqueirão", "embaré", "aparecida", "josé menino", "pompéia", "ponta da praia"];
          if (orlaSantos.some(b => pBairro.includes(b)) && orlaSantos.some(b => lBairro.includes(b))) {
            score += 15;
            reasons.push(`Mesma região da Orla (${property.bairro})`);
          }
        }
      } else {
        // Se NÃO há bairro especificado nem imóvel de entrada, não dá bônus artificial
        score -= 5;
      }

      // -------------------------------------------------------------
      // CAMADA 2: Compatibilidade de Tipologia
      // -------------------------------------------------------------
      if (property.tipo && tipoAlvo) {
        const pTipo = property.tipo.toLowerCase();
        const lTipo = tipoAlvo.toLowerCase();
        if (pTipo === lTipo || pTipo.includes(lTipo) || lTipo.includes(pTipo)) {
          score += 15;
          reasons.push(`Tipologia compatível: ${property.tipo}`);
        }
      }

      // -------------------------------------------------------------
      // CAMADA 3: Compatibilidade Financeira (Fit Realista)
      // -------------------------------------------------------------
      if (property.valorNumerico > 0 && valorAlvo && valorAlvo > 0) {
        const diffRatio = Math.abs(property.valorNumerico - valorAlvo) / valorAlvo;
        if (diffRatio <= 0.08) {
          score += 20;
          reasons.push(`Preço com fit exato de até 8% (${property.valor})`);
        } else if (diffRatio <= 0.15) {
          score += 12;
          reasons.push(`Preço dentro da margem de 15% (${property.valor})`);
        } else if (property.valorNumerico < valorAlvo) {
          score += 10;
          reasons.push(`Oportunidade com valor abaixo da referência`);
        }
      }

      // -------------------------------------------------------------
      // CAMADA 4: Dormitórios
      // -------------------------------------------------------------
      if (property.quartos && quartosAlvo) {
        if (property.quartos >= quartosAlvo) {
          score += 10;
          reasons.push(`Atende aos ${quartosAlvo} quartos desejados`);
        }
      }

      // -------------------------------------------------------------
      // CAMADA 5: Bônus Semânticos por Atributos da Descrição
      // -------------------------------------------------------------
      if (lead.querVaranda && property.hasVarandaGourmet) {
        score += 15;
        reasons.push("Varanda Gourmet confirmada na descrição");
      }
      if (lead.querVistaMar && property.hasVistaMar) {
        score += 15;
        reasons.push("Vista mar / quadra da praia destacada");
      }
      if (lead.exigeVagaFixa && property.hasVagaDemarcada) {
        score += 10;
        reasons.push("Garagem demarcada/privativa confirmada");
      }
      if (property.hasReforma) {
        score += 5;
        reasons.push("Imóvel reformado/modernizado");
      }

      // -------------------------------------------------------------
      // CAMADA 6: Calor do Atendimento
      // -------------------------------------------------------------
      if (lead.diasSemContato <= 2) {
        score += 5;
        reasons.push("Lead em atendimento recente (<48h)");
      }
      if (lead.temProposta || lead.temVisitaAgendada) {
        score += 5;
        reasons.push("Lead em fase de visita ou proposta");
      }

      // Cap at 99%
      const finalScore = Math.min(99, score);

      // Apenas registrar matches de alta precisão (>= 70% de afinidade)
      if (finalScore >= 70) {
        matches.push({
          id: `${property.codigo}-${lead.atendimentoId}`,
          score: finalScore,
          reasons,
          property,
          lead,
          corretorNome: lead.corretorNome || "Corretor Rhema",
          corretorCodigo: lead.corretorCodigo || "",
        });
      }
    }
  }

  // Ordenar por maior afinidade primeiro
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * 4. Busca em Tempo Real da Cadência de Atividades e SLA dos Corretores via API Imoview
 */
export async function fetchBrokerCadenceData(options?: { forceRefresh?: boolean }): Promise<BrokerCadenceItem[]> {
  const cache = globalForRadar.__rhemaBrokerRadarCache!;
  const nowMs = Date.now();
  if (
    !options?.forceRefresh &&
    cache.cadenceData &&
    nowMs - cache.cadenceData.timestamp < CACHE_TTL_MS
  ) {
    return cache.cadenceData.data;
  }

  const config = await getImoviewConfig();
  if (!config.apiKey) return [];

  const headers = buildHeaders(config.apiKey, true);
  const cleanBase = config.baseUrl;
  const now = new Date();

  // Janela dos últimos 30 dias até próximos 15 dias
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const formatApiDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const brokerMap = new Map<string, BrokerCadenceItem>();

  // 1. Carregar contatos dos corretores cadastrados no banco para obter telefones reais
  const registeredBrokers = await prisma.brokerContact.findMany({
    where: { ativo: true },
  });
  const brokerPhones = new Map<string, string>();
  for (const b of registeredBrokers) {
    if (b.imoviewCodigo) brokerPhones.set(b.imoviewCodigo, b.telefone);
    brokerPhones.set(b.nome.toLowerCase().trim(), b.telefone);
  }

  try {
    const u = new URL(`${cleanBase}/Agenda/RetornarAtividades`);
    u.searchParams.set("datainicio", formatApiDate(past30));
    u.searchParams.set("datafim", formatApiDate(future15));

    const res = await fetch(u.toString(), { method: "GET", headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const dayGroup of data) {
          if (!dayGroup.atividades || !Array.isArray(dayGroup.atividades)) continue;

          for (const atv of dayGroup.atividades) {
            const bCodigo = String(atv.codigousuario || "0");
            const bNome = (atv.nomeusuario || "Corretor Rhema").trim();

            if (!brokerMap.has(bCodigo)) {
              brokerMap.set(bCodigo, {
                corretorCodigo: bCodigo,
                corretorNome: bNome,
                corretorTelefone: brokerPhones.get(bCodigo) || brokerPhones.get(bNome.toLowerCase()) || undefined,
                atendimentosAtivos: 0,
                atividadesVencidas: 0,
                atividadesHoje: 0,
                atividadesFuturas: 0,
                atividadesConcluidas: 0,
                leadsSemContatoMais7Dias: 0,
                statusSla: "EM_DIA",
                ultimasAtividades: [],
              });
            }

            const item = brokerMap.get(bCodigo)!;

            const atvDate = parseBrDate(atv.datahorainicio);
            const isDone = Boolean(atv.realizada);
            const isPast = atvDate ? atvDate.getTime() < now.getTime() : false;
            const isToday = atvDate ? atvDate.toDateString() === now.toDateString() : false;

            if (isDone) {
              item.atividadesConcluidas += 1;
            } else if (isPast && !isToday) {
              item.atividadesVencidas += 1;
            } else if (isToday) {
              item.atividadesHoje += 1;
            } else {
              item.atividadesFuturas += 1;
            }

            if (item.ultimasAtividades.length < 5) {
              item.ultimasAtividades.push({
                codigo: atv.codigo,
                titulo: atv.titulo || "Atividade no Imoview",
                tipo: atv.nometipo || "Geral",
                dataHora: atv.datahorainicio || "",
                leadNome: atv.nomepessoa,
                imovelCodigo: atv.codigoimovel,
                realizada: isDone,
                atrasada: !isDone && isPast && !isToday,
              });
            }
          }
        }
      }
    }
  } catch (err: any) {
    logger.error("BrokerRadar", "Error fetching agenda activities:", err);
  }

  // 2. Complementar com atendimentos ativos por corretor para verificar volume e SLA
  try {
    const leads = await fetchHotLeadsForRadar({ mode: "all_active", limite: 200 });
    for (const lead of leads) {
      const bCodigo = lead.corretorCodigo || "0";
      const bNome = lead.corretorNome || "Corretor Rhema";

      if (!brokerMap.has(bCodigo)) {
        brokerMap.set(bCodigo, {
          corretorCodigo: bCodigo,
          corretorNome: bNome,
          corretorTelefone: brokerPhones.get(bCodigo) || brokerPhones.get(bNome.toLowerCase()) || undefined,
          atendimentosAtivos: 0,
          atividadesVencidas: 0,
          atividadesHoje: 0,
          atividadesFuturas: 0,
          atividadesConcluidas: 0,
          leadsSemContatoMais7Dias: 0,
          statusSla: "EM_DIA",
          ultimasAtividades: [],
        });
      }

      const item = brokerMap.get(bCodigo)!;
      item.atendimentosAtivos += 1;
      if (lead.diasSemContato > 7) {
        item.leadsSemContatoMais7Dias += 1;
      }
    }
  } catch (err: any) {
    logger.error("BrokerRadar", "Error augmenting cadence with leads:", err);
  }

  // 3. Classificar SLA
  const result = Array.from(brokerMap.values());
  for (const b of result) {
    if (b.atividadesVencidas >= 3 || b.leadsSemContatoMais7Dias >= 5) {
      b.statusSla = "CRITICO";
    } else if (b.atividadesVencidas > 0 || b.atividadesHoje > 0 || b.leadsSemContatoMais7Dias > 0) {
      b.statusSla = "ATENCAO";
    } else {
      b.statusSla = "EM_DIA";
    }
  }

  // Ordenar pelos mais críticos no topo
  result.sort((a, b) => {
    const weights = { CRITICO: 3, ATENCAO: 2, EM_DIA: 1 };
    return weights[b.statusSla] - weights[a.statusSla] || b.atividadesVencidas - a.atividadesVencidas;
  });

  cache.cadenceData = { data: result, timestamp: Date.now() };
  return result;
}

/**
 * 5. Formata a mensagem de Radar de Oportunidades para envio via WhatsApp ao Corretor
 */
export function formatBrokerRadarMessage(params: {
  corretorNome: string;
  matches: RadarMatch[];
}): string {
  const firstName = params.corretorNome.split(" ")[0];
  let text = `🚀 *Radar de Oportunidades Rhema* - Bom dia, ${firstName}!\n\n`;
  text += `Analisei as novas entradas no estoque da imobiliária e selecionei os melhores matches para a sua carteira quente de hoje:\n\n`;

  const topMatches = params.matches.slice(0, 4);

  topMatches.forEach((m, idx) => {
    text += `🔥 *${idx + 1}. Imóvel #${m.property.codigo} - ${m.property.bairro} (${m.property.valor})*\n`;
    text += `   • *Match:* ${m.score}% com seu cliente *${m.lead.clienteNome}*\n`;
    if (m.property.quartos) text += `   • *Dormitórios:* ${m.property.quartos} quartos\n`;
    if (m.property.captadorNome) text += `   • *Captação:* ${m.property.captadorNome}\n`;
    text += `   • *Link:* ${m.property.linkImovel}\n`;
    text += `   • *Fit:* ${m.reasons.slice(0, 2).join(", ")}\n\n`;
  });

  text += `💡 *Ação sugerida:* Vale acionar esses clientes logo pela manhã para apresentar essas novidades exclusivas em primeira mão!\n`;
  text += `Qualquer dúvida ou apoio na negociação, estou à disposição! 👊`;

  return text;
}

/**
 * 6. Formata a mensagem de Cadência e Cobrança de Atividades para envio via WhatsApp
 */
export function formatBrokerCadenceMessage(params: {
  corretorNome: string;
  atividadesVencidas: number;
  leadsParados: number;
  exemplosTitulos?: string[];
}): string {
  const firstName = params.corretorNome.split(" ")[0];
  let text = `👋 Fala *${firstName}*, tudo bem?\n\n`;
  text += `Passando aqui pelo acompanhamento diário do CRM Imoview:\n\n`;

  if (params.atividadesVencidas > 0) {
    text += `⚠️ *${params.atividadesVencidas} atividade(s) pendente(s)/vencida(s)* aguardando atualização na sua agenda do CRM.\n`;
  }
  if (params.leadsParados > 0) {
    text += `⏳ *${params.leadsParados} cliente(s) em atendimento* sem retorno há mais de 7 dias.\n`;
  }

  if (params.exemplosTitulos && params.exemplosTitulos.length > 0) {
    text += `\n📌 *Destaques prioritários:*\n`;
    params.exemplosTitulos.slice(0, 3).forEach((t) => {
      text += ` • ${t}\n`;
    });
  }

  text += `\nBora dar um gás e colocar esses retornos em dia hoje? Se precisar de algum suporte com algum cliente específico, só me avisar! 🚀`;

  return text;
}
