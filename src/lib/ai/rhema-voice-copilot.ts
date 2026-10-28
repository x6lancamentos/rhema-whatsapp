import { callOpenRouter } from "./openrouter-client";
import { transcribeAudioWithGroq } from "./groq-whisper-client";
import { recordImoviewInteraction } from "@/lib/imoview";
import { logger } from "@/lib/logger";

export type VoiceIntentType =
  | "PARECER_VISITA"
  | "FECHAMENTO_DIA"
  | "PRE_CAPTACAO"
  | "COMANDO_GESTOR"
  | "DUVIDA_GERAL";

export interface RhemaVoiceCopilotInput {
  /** Nome ou apelido do corretor/gestor que enviou a mensagem */
  remetenteNome: string;
  /** Se o remetente é o gestor (Brunno) */
  isGestor?: boolean;
  /** Texto já digitado OU deixar vazio se for áudio */
  texto?: string;
  /** Base64 ou Buffer do áudio de WhatsApp (.ogg / .mp3) */
  audioBase64?: string;
  audioMimeType?: string;
  /** Chaves de API (usam process.env como fallback) */
  openRouterApiKey?: string;
  groqApiKey?: string;
  /** Se true, apenas simula sem gravar no Supabase/Imoview */
  simulateOnly?: boolean;
}

export interface RhemaVoiceCopilotResult {
  transcricao: string;
  transcricaoLatencyMs: number;
  llmLatencyMs: number;
  modelUsed: string;
  intencao: VoiceIntentType;
  pontosPlacarEstimados: number;
  dadosEstruturados: Record<string, unknown>;
  respostaWhatsAppCalibrada: string;
  cardPrestacaoContasProprietario?: string | null;
  sincronizadoSupabase: boolean;
  detalhePersistencia: string;
}

const PERFIS_TOM_CORRETORES: Record<string, string> = {
  andre: "Respeitoso, estratégico e consultivo (16 anos de mercado). Sem microgerenciamento.",
  tatiana: "Motivacional, energético, celebra a garra e presença.",
  flavia: "Objetivo, focado em oportunidades de alto giro e visitas.",
  roseli: "Encorajador, reconhece o volume e consistência de esforço.",
  leniara: "Firme, objetivo, direto ao ponto e curto.",
  luana: "Direto, prático, pragmático e orientado a meta.",
  elaine: "Estruturado, apoia na organização de carteira e follow-up.",
  kaylane: "Empático, encorajador, suave e didático (rampa de entrada).",
  andressa: "Dinâmico, focado em tração rápida e captação.",
  brunno: "Executivo, direto, visão de comando comercial e alta performance.",
};

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function obterTomCorretor(nome: string): string {
  const n = norm(nome);
  for (const [chave, tom] of Object.entries(PERFIS_TOM_CORRETORES)) {
    if (n.includes(chave)) return tom;
  }
  return "Profissional, parceiro, direto e focado em alta performance imobiliária.";
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.RHEMA_SUPABASE_URL ||
  "https://xbenhpfweqpdwcpwciwn.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.RHEMA_SUPABASE_KEY ||
  "";

async function supabaseRest(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<unknown> {
  if (!SUPABASE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Persiste os dados extraídos do áudio diretamente no Supabase (Placar Rhema:
 * atividades_diarias, fechamentos_dia, blocos_rotina, fichas) e no Imoview CRM.
 */
async function persistirNoSupabaseEImoview(
  remetenteNome: string,
  intencao: VoiceIntentType,
  dados: Record<string, any>
): Promise<{ ok: boolean; detalhe: string }> {
  try {
    const hojeISO = new Date().toISOString().slice(0, 10);

    // 1. Se for PARECER_VISITA e houver referência de imóvel, registra no histórico do Imoview
    if (intencao === "PARECER_VISITA" && dados.imovelReferenciaOuEndereco) {
      await recordImoviewInteraction(
        String(dados.imovelReferenciaOuEndereco),
        `[Parecer de Visita via Voz — ${remetenteNome}] Cliente: ${dados.clienteNome || "N/I"} | Pontos positivos: ${dados.pontosPositivos || "N/I"} | Objeções: ${dados.objecoes || "N/I"} | Temperatura: ${dados.temperaturaLead || "morno"} | Próximo passo: ${dados.proximoPasso || "Follow-up"}`,
        "Rhema Voice Copilot"
      ).catch(() => {});
    }

    if (!SUPABASE_KEY) {
      return {
        ok: false,
        detalhe: "Chave Supabase não configurada no ambiente do WhatsApp Gateway (registro local concluído).",
      };
    }

    // 2. Busca perfil do corretor e tipos de atividade no Supabase
    const [profilesRaw, tiposRaw] = await Promise.all([
      supabaseRest("profiles?select=id,nome,apelido,ativo&ativo=eq.true"),
      supabaseRest("tipos_atividade?select=id,codigo&ativo=eq.true"),
    ]);

    const profiles = Array.isArray(profilesRaw) ? (profilesRaw as Array<{ id: string; nome: string; apelido?: string }>) : [];
    const tipos = Array.isArray(tiposRaw) ? (tiposRaw as Array<{ id: string; codigo: string }>) : [];

    const remNorm = norm(remetenteNome);
    const corretor = profiles.find((p) => {
      const n = norm(p.nome);
      const a = norm(p.apelido || p.nome.split(" ")[0]);
      return remNorm.includes(a) || a.includes(remNorm) || n.includes(remNorm);
    });

    if (!corretor) {
      return { ok: false, detalhe: `Corretor "${remetenteNome}" não localizado na tabela profiles.` };
    }

    const tipoIdPorCodigo = new Map<string, string>();
    for (const t of tipos) {
      tipoIdPorCodigo.set(t.codigo, t.id);
    }

    // 3. Grava conforme a intenção
    if (intencao === "FECHAMENTO_DIA") {
      const atv = (dados.atividadesDia || {}) as Record<string, number>;
      const mapa: Record<string, number> = {
        ligacao: Number(atv.ligacoes || 0),
        resgate: Number(atv.resgates || 0),
        atualizacao: Number(atv.atualizacoes || 0),
        captacao: Number(atv.captacoes || 0),
        visita: Number(atv.visitas || 0),
        proposta: Number(atv.propostas || 0),
        venda: Number(atv.vendas || 0),
      };

      const rows: Array<Record<string, unknown>> = [];
      for (const [cod, qtd] of Object.entries(mapa)) {
        const tId = tipoIdPorCodigo.get(cod);
        if (tId && qtd > 0) {
          rows.push({
            corretor_id: corretor.id,
            data: hojeISO,
            tipo_atividade_id: tId,
            quantidade: qtd,
            origem: "sync_crm",
            observacao: "Lançado via Áudio WhatsApp (Fricção Zero)",
          });
        }
      }

      if (rows.length > 0) {
        await supabaseRest("atividades_diarias?on_conflict=corretor_id,data,tipo_atividade_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: rows,
        });
      }

      await supabaseRest("fechamentos_dia?on_conflict=corretor_id,data", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: [
          {
            corretor_id: corretor.id,
            data: hojeISO,
            travou: dados.oQueTravouHoje || null,
            prioridade_amanha: dados.prioridadeAmanha || null,
          },
        ],
      });

      await supabaseRest("blocos_rotina?on_conflict=corretor_id,data", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: [
          {
            corretor_id: corretor.id,
            data: hojeISO,
            manha: true,
            tarde: true,
            fim_do_dia: true,
          },
        ],
      });

      return {
        ok: true,
        detalhe: `Check-out do dia gravado no Supabase para ${corretor.nome} (${rows.length} indicadores + fechamentos_dia).`,
      };
    }

    if (intencao === "PARECER_VISITA") {
      const visitaTipoId = tipoIdPorCodigo.get("visita");
      if (visitaTipoId) {
        const existentes = (await supabaseRest(
          `atividades_diarias?select=quantidade&corretor_id=eq.${corretor.id}&data=eq.${hojeISO}&tipo_atividade_id=eq.${visitaTipoId}`
        )) as Array<{ quantidade: number }> | null;
        const qtdAtual = existentes?.[0]?.quantidade ? Number(existentes[0].quantidade) : 0;

        await supabaseRest("atividades_diarias?on_conflict=corretor_id,data,tipo_atividade_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: [
            {
              corretor_id: corretor.id,
              data: hojeISO,
              tipo_atividade_id: visitaTipoId,
              quantidade: qtdAtual + 1,
              origem: "sync_crm",
              observacao: `Parecer de visita por voz (${dados.clienteNome || "Cliente"})`,
            },
          ],
        });
      }
      return {
        ok: true,
        detalhe: `Parecer de visita registrado (+15 pts no Placar de ${corretor.nome}).`,
      };
    }

    if (intencao === "PRE_CAPTACAO") {
      const capTipoId = tipoIdPorCodigo.get("captacao");
      if (capTipoId) {
        const existentes = (await supabaseRest(
          `atividades_diarias?select=quantidade&corretor_id=eq.${corretor.id}&data=eq.${hojeISO}&tipo_atividade_id=eq.${capTipoId}`
        )) as Array<{ quantidade: number }> | null;
        const qtdAtual = existentes?.[0]?.quantidade ? Number(existentes[0].quantidade) : 0;

        await supabaseRest("atividades_diarias?on_conflict=corretor_id,data,tipo_atividade_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: [
            {
              corretor_id: corretor.id,
              data: hojeISO,
              tipo_atividade_id: capTipoId,
              quantidade: qtdAtual + 1,
              origem: "sync_crm",
              observacao: `Pré-captação por voz (${dados.imovelReferenciaOuEndereco || dados.bairro || "Santos"})`,
            },
          ],
        });
      }
      return {
        ok: true,
        detalhe: `Pré-captação registrada (+5 pts no Placar de ${corretor.nome}).`,
      };
    }

    return { ok: true, detalhe: "Processado pelo Orquestrador Comercial." };
  } catch (err) {
    logger.warn("RhemaVoiceCopilot", "Aviso ao persistir no Supabase/Imoview:", err);
    return { ok: false, detalhe: "Processado localmente (falha de rede ao sincronizar Supabase)." };
  }
}

/**
 * Processa áudio (Groq Whisper Free) + raciocínio (OpenRouter Nvidia Nemotron Free)
 * transformando a mensagem de voz/texto do corretor em CRM + Pontos do Placar Rhema.
 */
export async function processRhemaVoiceOrText(
  input: RhemaVoiceCopilotInput
): Promise<RhemaVoiceCopilotResult> {
  let transcricao = (input.texto || "").trim();
  let transcricaoLatencyMs = 0;

  if (!transcricao && input.audioBase64) {
    const stt = await transcribeAudioWithGroq({
      apiKey: input.groqApiKey,
      audioData: input.audioBase64,
      mimeType: input.audioMimeType || "audio/ogg",
    });
    transcricao = stt.text;
    transcricaoLatencyMs = stt.latencyMs;
  }

  if (!transcricao) {
    throw new Error("Nenhum texto ou áudio válido fornecido para processamento.");
  }

  const openRouterKey = (input.openRouterApiKey || process.env.OPENROUTER_API_KEY || "").trim();
  if (!openRouterKey) {
    throw new Error("OPENROUTER_API_KEY não configurada.");
  }

  const tomPerfil = obterTomCorretor(input.remetenteNome);

  const systemPrompt = `Você é o Agente Operacional de Voz & Performance do Rhema OS (Rhema Imóveis — Santos/SP).
Você acabou de receber uma mensagem (transcrita de áudio de WhatsApp) enviada por: ${input.remetenteNome} (${input.isGestor ? "Gestor Comercial" : "Corretor(a)"}).
Tom obrigatório para responder a esta pessoa: ${tomPerfil}

Regras Oficiais do Placar Rhema:
- Ligação = 1 pt (teto 25/dia)
- Resgate = 2 pts (teto 15/dia)
- Atualização = 1 pt (teto 15/dia)
- Captação = 5 pts (teto 4/dia)
- Visita = 15 pts (teto 5/dia)
- Proposta = 50 pts (teto 4/dia)
- Venda = 200 pts (sem teto)

Classifique a mensagem em UMA das intenções abaixo e extraia os dados em formato JSON estrito:
1. "PARECER_VISITA": Corretor relatando como foi uma visita a um imóvel com cliente.
2. "FECHAMENTO_DIA": Corretor relatando os números do dia, o que travou hoje e a prioridade nº 1 de amanhã.
3. "PRE_CAPTACAO": Corretor passando dados de um imóvel captado na rua (endereço, quartos, valor, proprietário).
4. "COMANDO_GESTOR": Gestor pedindo diagnóstico, relatório, cobrança de SLA ou ação na equipe.
5. "DUVIDA_GERAL": Outras solicitações operacionais.

Retorne APENAS um JSON válido com a estrutura:
{
  "intencao": "PARECER_VISITA" | "FECHAMENTO_DIA" | "PRE_CAPTACAO" | "COMANDO_GESTOR" | "DUVIDA_GERAL",
  "pontosPlacarEstimados": number,
  "dadosEstruturados": {
    "clienteNome": string | null,
    "imovelReferenciaOuEndereco": string | null,
    "bairro": string | null,
    "valorImovelOuProposta": number | null,
    "temperaturaLead": "quente" | "morno" | "frio" | null,
    "pontosPositivos": string | null,
    "objecoes": string | null,
    "proximoPasso": string | null,
    "atividadesDia": {
      "ligacoes": number,
      "resgates": number,
      "atualizacoes": number,
      "captacoes": number,
      "visitas": number,
      "propostas": number,
      "vendas": number
    } | null,
    "oQueTravouHoje": string | null,
    "prioridadeAmanha": string | null
  },
  "respostaWhatsAppCalibrada": "Mensagem curta, pronta para enviar no WhatsApp confirmando o registro no Imoview/Placar e dando o próximo passo estratégico calibrado ao perfil do corretor."
}`;

  const llmResponse = await callOpenRouter({
    apiKey: openRouterKey,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Mensagem transcrita: "${transcricao}"` },
    ],
    temperature: 0.2,
    responseFormatJson: true,
  });

  let parsed: {
    intencao?: VoiceIntentType;
    pontosPlacarEstimados?: number;
    dadosEstruturados?: Record<string, unknown>;
    respostaWhatsAppCalibrada?: string;
  } = {};

  try {
    const cleaned = llmResponse.content
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.warn("RhemaVoiceCopilot", "Falha ao fazer parse JSON direto da resposta; extraindo bloco JSON", err);
    const match = llmResponse.content.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    }
  }

  const intencaoFinal = parsed.intencao || "DUVIDA_GERAL";
  const dadosEstruturados = parsed.dadosEstruturados || {};

  // Trava RBAC no Pipeline de Voz: se um corretor mandar áudio tentando acionar COMANDO_GESTOR, bloqueia
  if (intencaoFinal === "COMANDO_GESTOR" && !input.isGestor) {
    return {
      transcricao,
      transcricaoLatencyMs,
      llmLatencyMs: llmResponse.latencyMs,
      modelUsed: llmResponse.modelUsed,
      intencao: "COMANDO_GESTOR",
      pontosPlacarEstimados: 0,
      dadosEstruturados,
      respostaWhatsAppCalibrada: `🔒 *Acesso Restrito à Diretoria Comercial*\nComandos de gestão, homologação e diagnóstico da equipe são exclusivos do Gestor Comandante (Brunno Anastácio).\n\nEnvie *#meuplacar* ou *#meusleads* para consultar sua carteira individual!`,
      cardPrestacaoContasProprietario: null,
      sincronizadoSupabase: false,
      detalhePersistencia: "Bloqueado por RBAC (exclusivo Gestor).",
    };
  }

  let sincronizadoSupabase = false;
  let detalhePersistencia = "Simulação (sem gravação em banco).";

  if (!input.simulateOnly) {
    const persist = await persistirNoSupabaseEImoview(input.remetenteNome, intencaoFinal, dadosEstruturados);
    sincronizadoSupabase = persist.ok;
    detalhePersistencia = persist.detalhe;
  }

  // Melhoria M3: Gera automaticamente o Card de Prestação de Contas ao Proprietário quando for PARECER_VISITA
  let cardPrestacaoContasProprietario: string | null = null;
  if (intencaoFinal === "PARECER_VISITA") {
    const refImovel = String(
      dadosEstruturados.imovelReferenciaOuEndereco || dadosEstruturados.bairro || "seu imóvel em Santos"
    );
    const elogios = String(
      dadosEstruturados.pontosPositivos || "a planta, localização e estado de conservação do imóvel"
    );
    const percepcaoMercado = dadosEstruturados.objecoes
      ? `O cliente ponderou sobre ${String(dadosEstruturados.objecoes)}, ponto que já estamos trabalhando tecnicamente no nosso follow-up.`
      : `O imóvel causou excelente impressão e seguimos em tratativa ativa de evolução para proposta.`;

    cardPrestacaoContasProprietario = `🏡 *Prestação de Contas Rhema Imóveis — Visita Realizada*\n_"Olá, tudo bem? Passando para prestar contas da visita que acabamos de realizar no ${refImovel}. O cliente destacou positivamente ${elogios}. ${percepcaoMercado} Seguimos com o acompanhamento rigoroso da Exclusividade Rhema e te mantenho informado(a) dos próximos passos!"_`;
  }

  return {
    transcricao,
    transcricaoLatencyMs,
    llmLatencyMs: llmResponse.latencyMs,
    modelUsed: llmResponse.modelUsed,
    intencao: intencaoFinal,
    pontosPlacarEstimados: Number(parsed.pontosPlacarEstimados || 0),
    dadosEstruturados,
    respostaWhatsAppCalibrada:
      parsed.respostaWhatsAppCalibrada ||
      `Recebido, ${input.remetenteNome}! Já processei seu áudio no Rhema OS.`,
    cardPrestacaoContasProprietario,
    sincronizadoSupabase,
    detalhePersistencia,
  };
}
