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
  statusAtendimento?: string;
  temVisitaAgendada?: boolean;
  temProposta?: boolean;
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

function buildHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    chave: apiKey.trim(),
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
}): Promise<RadarProperty[]> {
  const config = await getImoviewConfig();
  if (!config.apiKey) return [];

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;
  const maxLimit = options.limite ?? 60;
  const diasMaximos = options.diasMaximos ?? 7;
  const now = Date.now();
  const allProperties: RadarProperty[] = [];

  const finalidades = options.finalidade && options.finalidade !== "0"
    ? [options.finalidade]
    : ["2", "1"];

  for (const fin of finalidades) {
    if (allProperties.length >= maxLimit) break;

    for (let page = 1; page <= 5; page++) {
      if (allProperties.length >= maxLimit) break;

      try {
        const bodyPayload: any = {
          numeroPagina: page,
          numeroRegistros: 20,
          finalidade: fin,
          ordenacao: "-1", // Imóveis mais recentes primeiro
        };

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
          const dateStr = item.datahoraultimavalidacao || item.datahoracadastro || item.datahoraultimaalteracao;
          const propDate = parseBrDate(dateStr);
          const diffDays = propDate
            ? Math.max(0, Math.floor((now - propDate.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          // Se diasMaximos > 0, filtra apenas os imóveis incluídos/validados no período
          if (diasMaximos > 0 && diffDays > diasMaximos) {
            continue;
          }

          if (options.bairro && item.bairro && !item.bairro.toLowerCase().includes(options.bairro.toLowerCase())) {
            continue;
          }

          if (options.tipo && item.tipo && !item.tipo.toLowerCase().includes(options.tipo.toLowerCase())) {
            continue;
          }

          const rawValor = item.valor || 0;
          const valorNum = parseCurrencyNumber(rawValor);
          const formattedValor = valorNum > 0 ? formatarMoeda(valorNum) || `R$ ${valorNum.toLocaleString("pt-BR")}` : "Sob Consulta";
          const formattedCond = formatarMoeda(item.valorcondominio);
          const formattedIptu = formatarMoeda(item.valoriptu);

          const captadorNome = item.captadores?.[0]?.nome || item.nomecaptador || item.corretornome || "Rhema Imóveis";
          const captadorCodigo = item.captadores?.[0]?.codigo ? String(item.captadores[0].codigo) : (item.codigocaptador ? String(item.codigocaptador) : undefined);

          allProperties.push({
            codigo: String(item.codigo),
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
            linkImovel: `https://www.rhemaimoveis.com.br/imovel/${item.codigo}`,
            situacao: item.situacao || "Disponível",
          });

          if (allProperties.length >= maxLimit) break;
        }
      } catch (err: any) {
        logger.error("BrokerRadar", `Error fetching stock properties page ${page}:`, err);
        break;
      }
    }
  }

  // Ordenar pelos mais recentes no topo (menos dias de estoque)
  allProperties.sort((a, b) => a.diasNoEstoque - b.diasNoEstoque);
  return allProperties;
}

/**
 * 2. Busca leads quentes ou pipeline em andamento via API do Imoview
 */
export async function fetchHotLeadsForRadar(options: {
  mode?: "hot_7days" | "all_active"; // Padrão: hot_7days
  corretorCodigo?: string;
  limite?: number;
}): Promise<RadarLead[]> {
  const config = await getImoviewConfig();
  if (!config.apiKey) return [];

  const headers = buildHeaders(config.apiKey);
  const cleanBase = config.baseUrl;
  const maxLimit = options.limite ?? 120;
  const isHotOnly = options.mode !== "all_active";
  const now = Date.now();
  const allLeads: RadarLead[] = [];

  for (const finalidade of ["2", "1"]) {
    if (allLeads.length >= maxLimit) break;

    for (let page = 1; page <= 6; page++) {
      if (allLeads.length >= maxLimit) break;

      try {
        const u = new URL(`${cleanBase}/Atendimento/RetornarAtendimentos`);
        u.searchParams.set("numeroPagina", String(page));
        u.searchParams.set("numeroRegistros", "20");
        u.searchParams.set("finalidade", finalidade);
        u.searchParams.set("fase", "0");
        u.searchParams.set("situacao", "1"); // 1 = Em atendimento / Em andamento

        if (options.corretorCodigo) {
          u.searchParams.set("codigoCorretor", options.corretorCodigo);
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

          // Se filtrou por corretor específico
          if (options.corretorCodigo && String(item.corretorcodigo) !== options.corretorCodigo) {
            continue;
          }

          const dateStr = item.datahoraultimainteracao || item.datahorainclusao;
          const contactDate = parseBrDate(dateStr);
          const diffDays = contactDate
            ? Math.max(0, Math.floor((now - contactDate.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          // Filtro padrão: leads quentes dos últimos 7 dias
          if (isHotOnly && diffDays > 7) {
            continue;
          }

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
          const valorInteresse = valorNumerico ? formatarMoeda(valorNumerico) : (rawValor ? String(rawValor) : undefined);
          const quartos = prop?.numeroquartos != null ? Number(prop.numeroquartos) : (item.numeroquartos != null ? Number(item.numeroquartos) : undefined);
          const vagas = prop?.numerovagas != null ? Number(prop.numerovagas) : (item.numerovagas != null ? Number(item.numerovagas) : undefined);

          const temVisita = Array.isArray(item.imoveisvisita) && item.imoveisvisita.length > 0;
          const temProposta = Array.isArray(item.imoveisproposta) && item.imoveisproposta.length > 0;

          const ultimoHistorico =
            item.interacoes && item.interacoes.length > 0
              ? item.interacoes[0].descricao || item.interacoes[0].texto || "Interação no CRM"
              : "Sem histórico";

          allLeads.push({
            atendimentoId: String(item.codigo),
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
            termometro: item.termometro || (temProposta ? "Quente" : (temVisita ? "Morno" : "Indefinido")),
            diasSemContato: diffDays,
            dataUltimoContato: dateStr,
            ultimoHistorico,
            statusAtendimento: item.situacao || "Em atendimento",
            temVisitaAgendada: temVisita,
            temProposta,
          });

          if (allLeads.length >= maxLimit) break;
        }
      } catch (err: any) {
        logger.error("BrokerRadar", `Error fetching leads page ${page}:`, err);
        break;
      }
    }
  }

  // Ordenar pelo contato mais recente primeiro
  allLeads.sort((a, b) => a.diasSemContato - b.diasSemContato);
  return allLeads;
}

/**
 * 3. Algoritmo de Combinações Inteligentes (Estoque Novo ⟷ Leads Quentes)
 */
export function computeStockLeadMatches(
  properties: RadarProperty[],
  leads: RadarLead[]
): RadarMatch[] {
  const matches: RadarMatch[] = [];

  for (const property of properties) {
    for (const lead of leads) {
      let score = 50; // Base score de potencial
      const reasons: string[] = [];

      // 1. Compatibilidade de Bairro
      if (property.bairro && lead.bairroInteresse) {
        const pBairro = property.bairro.toLowerCase().trim();
        const lBairro = lead.bairroInteresse.toLowerCase().trim();

        if (pBairro === lBairro || pBairro.includes(lBairro) || lBairro.includes(pBairro)) {
          score += 25;
          reasons.push(`Bairro exato: ${property.bairro}`);
        } else {
          // Bairros vizinhos de Santos
          const orlaSantos = ["gonzaga", "boqueirão", "embaré", "aparecida", "josé menino", "pompéia", "ponta da praia"];
          if (orlaSantos.some(b => pBairro.includes(b)) && orlaSantos.some(b => lBairro.includes(b))) {
            score += 15;
            reasons.push(`Mesma região nobre da Orla (${property.bairro})`);
          }
        }
      } else {
        score += 10; // Sem bairro fixo no lead = flexível
      }

      // 2. Compatibilidade de Tipologia
      if (property.tipo && lead.tipoImovel) {
        const pTipo = property.tipo.toLowerCase();
        const lTipo = lead.tipoImovel.toLowerCase();
        if (pTipo === lTipo || pTipo.includes(lTipo) || lTipo.includes(pTipo)) {
          score += 15;
          reasons.push(`Tipologia compatível: ${property.tipo}`);
        }
      }

      // 3. Compatibilidade Financeira (Faixa de Preço ±20%)
      if (property.valorNumerico > 0 && lead.valorNumerico && lead.valorNumerico > 0) {
        const diffRatio = Math.abs(property.valorNumerico - lead.valorNumerico) / lead.valorNumerico;
        if (diffRatio <= 0.10) {
          score += 20;
          reasons.push(`Preço com fit exato de até 10% (${property.valor})`);
        } else if (diffRatio <= 0.20) {
          score += 10;
          reasons.push(`Preço dentro da margem de 20% (${property.valor})`);
        } else if (property.valorNumerico < lead.valorNumerico) {
          score += 10;
          reasons.push(`Excelente oportunidade abaixo do orçamento`);
        }
      }

      // 4. Dormitórios
      if (property.quartos && lead.quartos) {
        if (property.quartos >= lead.quartos) {
          score += 10;
          reasons.push(`Atende aos ${lead.quartos} quartos solicitados`);
        }
      }

      // 5. Bônus de Calor do Lead
      if (lead.diasSemContato <= 2) {
        score += 5;
        reasons.push("Lead muito quente (contato nas últimas 48h)");
      }
      if (lead.temProposta || lead.temVisitaAgendada) {
        score += 5;
        reasons.push("Lead em fase de visita ou proposta");
      }

      // Cap at 98%
      const finalScore = Math.min(98, score);

      // Apenas registrar matches relevantes (>= 65% de afinidade)
      if (finalScore >= 65) {
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
export async function fetchBrokerCadenceData(): Promise<BrokerCadenceItem[]> {
  const config = await getImoviewConfig();
  if (!config.apiKey) return [];

  const headers = buildHeaders(config.apiKey);
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
