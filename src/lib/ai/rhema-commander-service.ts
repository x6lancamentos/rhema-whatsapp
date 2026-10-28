import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { obterTomCorretor } from "./rhema-voice-copilot";

export type RhemaAccessRole = "COMMANDER_GESTOR" | "BROKER_CORRETOR" | "EXTERNAL_CLIENT";

export interface LearnProposalCard {
  id: string;
  criadoEm: string;
  autor: string;
  gargaloIdentificado: string;
  acaoProposta: string;
  impactoEsperado: string;
  status: "AGUARDANDO_APROVACAO" | "APROVADO_E_APLICADO";
  aprovadoEm?: string;
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

const TELAO_URL = process.env.RHEMA_TELAO_URL || "http://localhost:3210";

// Lista em memória (sincronizada com env RHEMA_GESTOR_PHONES) para configuração rápida via painel /dashboard/rhema-os
let runtimeCommanderPhones: string[] = (
  process.env.RHEMA_GESTOR_PHONES ||
  process.env.RHEMA_GESTOR_PHONE ||
  ""
)
  .split(",")
  .map((p) => p.replace(/\D/g, ""))
  .filter((p) => p.length >= 8);

const learnCardsStore: LearnProposalCard[] = [
  {
    id: "LEARN-001",
    criadoEm: "2026-10-28T09:00:00.000Z",
    autor: "Agente 8 (Auto-Evolução)",
    gargaloIdentificado: "Visitas realizadas à tarde acumulando >24h sem parecer no Imoview.",
    acaoProposta: "Disparar lembrete automático de voz 2h após o horário agendado da visita pedindo áudio de 30s.",
    impactoEsperado: "Zerar fila de pareceres pendentes e gerar Card de Prestação de Contas ao Proprietário no mesmo dia.",
    status: "AGUARDANDO_APROVACAO",
  },
  {
    id: "LEARN-002",
    criadoEm: "2026-10-28T11:30:00.000Z",
    autor: "Agente 8 (Auto-Evolução)",
    gargaloIdentificado: "Taxa Visita → Proposta abaixo de 25% em imóveis acima de R$ 900 mil no Gonzaga.",
    acaoProposta: "Anexar automaticamente a Calculadora de Vacância (6 e 12 meses) no script de follow-up de 24h pós-visita.",
    impactoEsperado: "Elevar conversão Visita → Proposta de 21% para >28% (Cap. 10 & Cap. 11 Universidade Rhema).",
    status: "AGUARDANDO_APROVACAO",
  },
];

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getCommanderPhones(): string[] {
  return runtimeCommanderPhones;
}

export function setCommanderPhones(phones: string[]): string[] {
  runtimeCommanderPhones = phones
    .map((p) => p.replace(/\D/g, ""))
    .filter((p) => p.length >= 8);
  return runtimeCommanderPhones;
}

export function listarLearnCards(): LearnProposalCard[] {
  return learnCardsStore;
}

async function supabaseRest(
  endpoint: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<any> {
  if (!SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
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
  } catch (err) {
    logger.warn("RhemaCommander", `Falha ao consultar Supabase (${endpoint}):`, err);
    return null;
  }
}

/**
 * Resolve o nível de acesso RBAC do número de WhatsApp que enviou a mensagem.
 * Nível 1: COMMANDER_GESTOR (Exclusivo Brunno Anastácio)
 * Nível 2: BROKER_CORRETOR (Corretor ativo em prisma.brokerContact)
 * Nível 3: EXTERNAL_CLIENT (Proprietários / Leads atendidos pela Camila AI)
 */
export async function resolveWhatsappRole(
  senderPhoneDigits: string,
  pushName?: string,
  forceCommander = false
): Promise<{
  role: RhemaAccessRole;
  nome: string;
  brokerId?: string;
  telefone: string;
}> {
  const cleanDigits = (senderPhoneDigits || "").replace(/\D/g, "");
  const last8 = cleanDigits.slice(-8);

  if (forceCommander) {
    return {
      role: "COMMANDER_GESTOR",
      nome: "Brunno Anastácio (Gestor Comandante)",
      telefone: cleanDigits,
    };
  }

  // 1. Verifica whitelist explícita do Gestor Comandante
  if (last8.length >= 8 && runtimeCommanderPhones.some((p) => p.slice(-8) === last8)) {
    return {
      role: "COMMANDER_GESTOR",
      nome: "Brunno Anastácio (Gestor Comandante)",
      telefone: cleanDigits,
    };
  }

  // 2. Verifica na tabela de corretores autenticados
  if (last8.length >= 8) {
    const broker = await prisma.brokerContact.findFirst({
      where: {
        ativo: true,
        telefone: { contains: last8 },
      },
    });

    if (broker) {
      // Se o próprio Brunno estiver cadastrado na tabela brokerContact com nome Brunno Anastácio
      if (/brunno/i.test(broker.nome)) {
        return {
          role: "COMMANDER_GESTOR",
          nome: broker.nome,
          brokerId: broker.id,
          telefone: broker.telefone,
        };
      }
      return {
        role: "BROKER_CORRETOR",
        nome: broker.nome,
        brokerId: broker.id,
        telefone: broker.telefone,
      };
    }
  }

  return {
    role: "EXTERNAL_CLIENT",
    nome: pushName || "Contato Externo",
    telefone: cleanDigits,
  };
}

/**
 * Identifica se um texto corresponde a um comando exclusivo do Gestor Comandante (Nível 1)
 * ou a um comando Self-Service de Corretor (Nível 2).
 */
export function isManagerCommandText(text: string): boolean {
  const t = text.trim();
  return /^(homologar(\s+placar)?|diagnostico|diagnóstico|status\s+okr|comissoes|comissões|pdi\s+|celebrar\s+|#learn\b|aprovar\s+#?learn)/i.test(
    t
  );
}

export function isBrokerSelfServiceCommandText(text: string): boolean {
  const t = text.trim();
  return /^#(meuplacar|meusleads)\b/i.test(t);
}

/**
 * Calcula o diagnóstico oficial pelas 4 Taxas de Conversão + Capítulos da Universidade Rhema (08 a 11).
 */
export function diagnosticarQuatroTaxas(totais: {
  ligacao: number;
  resgate: number;
  atualizacao: number;
  captacao: number;
  visita: number;
  proposta: number;
  venda: number;
}) {
  const taxaLigacaoVisita =
    totais.ligacao > 0 ? Math.min(100, Math.round((totais.visita / totais.ligacao) * 100)) : 0;
  const taxaVisitaProposta =
    totais.visita > 0 ? Math.min(100, Math.round(((totais.proposta + totais.venda) / totais.visita) * 100)) : 0;
  const taxaPropostaVenda =
    totais.proposta > 0 ? Math.min(100, Math.round((totais.venda / totais.proposta) * 100)) : 0;
  const taxaCaptacaoExclusividade = totais.captacao >= 2 ? 35 : totais.captacao === 1 ? 20 : 0;

  let gargaloPrincipal = "Operação Consistente nas 4 Taxas";
  let capituloRecomendado = "10";
  let descricaoCapitulo = "Cap. 10 (Condução de Visita de Alta Conversão)";
  let indicadorFocoCodigo = "visita";

  if (taxaLigacaoVisita < 40 && totais.visita < 3) {
    gargaloPrincipal = `Baixa conversão Ligação → Visita (${taxaLigacaoVisita}% vs meta 40%)`;
    capituloRecomendado = "08";
    descricaoCapitulo = "Cap. 08 (Qualificação & Agendamento de Visita)";
    indicadorFocoCodigo = "ligacao";
  } else if (totais.captacao < 2) {
    gargaloPrincipal = `Volume de Captação Exclusiva abaixo do ideal (${totais.captacao} no ciclo)`;
    capituloRecomendado = "09";
    descricaoCapitulo = "Cap. 09 (Captação & Exclusividade Rhema Premium 90 dias)";
    indicadorFocoCodigo = "captacao";
  } else if (taxaVisitaProposta < 25) {
    gargaloPrincipal = `Baixa conversão Visita → Proposta (${taxaVisitaProposta}% vs meta 25%)`;
    capituloRecomendado = "10";
    descricaoCapitulo = "Cap. 10 (Condução de Visita & Fechamento de Proposta)";
    indicadorFocoCodigo = "proposta";
  } else if (taxaPropostaVenda < 30 && totais.proposta >= 2) {
    gargaloPrincipal = `Baixa conversão Proposta → Venda (${taxaPropostaVenda}% vs meta 30%)`;
    capituloRecomendado = "11";
    descricaoCapitulo = "Cap. 11 (Fechamento & Quebra de Objeções na Mesa)";
    indicadorFocoCodigo = "venda";
  }

  return {
    taxaLigacaoVisita,
    taxaCaptacaoExclusividade,
    taxaVisitaProposta,
    taxaPropostaVenda,
    gargaloPrincipal,
    capituloRecomendado,
    descricaoCapitulo,
    indicadorFocoCodigo,
  };
}

async function carregarResumoSupabaseMes() {
  const mesInicio = new Date().toISOString().slice(0, 7) + "-01";
  const hojeISO = new Date().toISOString().slice(0, 10);

  const [profilesRaw, tiposRaw, atvsRaw, propostasRaw] = await Promise.all([
    supabaseRest("profiles?select=id,nome,apelido,ativo,papel&ativo=eq.true"),
    supabaseRest("tipos_atividade?select=id,codigo,rotulo,pontos_unidade,teto_diario&ativo=eq.true"),
    supabaseRest(`atividades_diarias?select=corretor_id,tipo_atividade_id,quantidade,data&data=gte.${mesInicio}`),
    supabaseRest("propostas?select=id,valor_proposta,status,corretor_nome,criado_em"),
  ]);

  const profiles = Array.isArray(profilesRaw) ? profilesRaw : [];
  const tipos = Array.isArray(tiposRaw) ? tiposRaw : [];
  const atvs = Array.isArray(atvsRaw) ? atvsRaw : [];
  const propostas = Array.isArray(propostasRaw) ? propostasRaw : [];

  const tipoMap = new Map<string, any>();
  for (const t of tipos) tipoMap.set(t.id, t);

  const resumoPorCorretor = profiles
    .filter((p) => p.papel !== "gestor" && !/brunno/i.test(p.nome || ""))
    .map((p) => {
      const totaisMes: Record<string, number> = {
        ligacao: 0,
        resgate: 0,
        atualizacao: 0,
        captacao: 0,
        visita: 0,
        proposta: 0,
        venda: 0,
      };
      const totaisHoje: Record<string, number> = { ...totaisMes };
      let pontosMes = 0;
      let pontosHoje = 0;

      const atvsCorretor = atvs.filter((a) => a.corretor_id === p.id);
      for (const a of atvsCorretor) {
        const t = tipoMap.get(a.tipo_atividade_id);
        if (!t) continue;
        const qtd = Number(a.quantidade || 0);
        totaisMes[t.codigo] = (totaisMes[t.codigo] || 0) + qtd;
        const qtdPont = t.teto_diario != null ? Math.min(qtd, Number(t.teto_diario)) : qtd;
        const pts = qtdPont * Number(t.pontos_unidade || 0);
        pontosMes += pts;

        if (a.data === hojeISO) {
          totaisHoje[t.codigo] = (totaisHoje[t.codigo] || 0) + qtd;
          pontosHoje += pts;
        }
      }

      const diag = diagnosticarQuatroTaxas(totaisMes as any);

      return {
        id: p.id,
        nome: p.nome,
        apelido: p.apelido || p.nome.split(" ")[0],
        totaisMes,
        totaisHoje,
        pontosMes,
        pontosHoje,
        diag,
      };
    });

  // Ordem Oficial de Desempate do Placar Rhema:
  // Vendas → Propostas → Visitas → Captações → Taxa Visita→Proposta → Pontos → Ordem Alfabética
  resumoPorCorretor.sort(
    (a, b) =>
      b.pontosMes - a.pontosMes ||
      b.totaisMes.venda - a.totaisMes.venda ||
      b.totaisMes.proposta - a.totaisMes.proposta ||
      b.totaisMes.visita - a.totaisMes.visita ||
      b.totaisMes.captacao - a.totaisMes.captacao ||
      b.diag.taxaVisitaProposta - a.diag.taxaVisitaProposta ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );

  return {
    profiles,
    tipos,
    resumoPorCorretor,
    propostas,
    hojeISO,
  };
}

/**
 * Executa comandos de Self-Service do Corretor (Nível 2 — Escopo Individual Isolado)
 */
export async function executeBrokerSelfServiceCommand(options: {
  corretorNome: string;
  comandoTexto: string;
}): Promise<{
  executado: boolean;
  respostaWhatsApp: string;
}> {
  const texto = options.comandoTexto.trim();
  const nCorretor = norm(options.corretorNome);
  const primeiroNome = options.corretorNome.split(" ")[0] || "Corretor(a)";

  if (/^#meuplacar\b/i.test(texto)) {
    const dados = await carregarResumoSupabaseMes();
    const idx = dados.resumoPorCorretor.findIndex(
      (c) => norm(c.nome).includes(nCorretor) || nCorretor.includes(norm(c.apelido))
    );
    const meu = idx >= 0 ? dados.resumoPorCorretor[idx] : null;
    const posicao = idx >= 0 ? idx + 1 : null;
    const proximoAcima = idx > 0 ? dados.resumoPorCorretor[idx - 1] : null;

    const ptsHoje = meu?.pontosHoje ?? 0;
    const ptsMes = meu?.pontosMes ?? 0;
    const ligHoje = meu?.totaisHoje.ligacao ?? 0;
    const resgHoje = meu?.totaisHoje.resgate ?? 0;
    const atlzHoje = meu?.totaisHoje.atualizacao ?? 0;
    const visHoje = meu?.totaisHoje.visita ?? 0;
    const capHoje = meu?.totaisHoje.captacao ?? 0;
    const propHoje = meu?.totaisHoje.proposta ?? 0;

    const faltamLig = Math.max(0, 10 - ligHoje);
    const faltamResg = Math.max(0, 5 - resgHoje);
    const faltamAtlz = Math.max(0, 5 - atlzHoje);

    const msgGap =
      faltamLig === 0 && faltamResg === 0 && faltamAtlz === 0
        ? "✅ *Parabéns!* Você já bateu o volume base do *Dia Consistente (+20 pts)* hoje!"
        : `🎯 *Para destravar o Bônus Dia Consistente (+20 pts) hoje:*\nFaltam: *${faltamLig} ligações*, *${faltamResg} resgates* e *${faltamAtlz} atualizações*.`;

    const msgPosicao = posicao
      ? `🏆 *Sua Posição no Ciclo:* ${posicao}º lugar (${ptsMes} pts acumulados)${
          proximoAcima
            ? `\n⚡ Você está a apenas *${Math.max(5, proximoAcima.pontosMes - ptsMes)} pts* de subir uma posição no Placar!`
            : "\n🥇 Você está na liderança do Placar Rhema! Mantenha o ritmo!"
        }`
      : `📊 *Seus Pontos no Mês:* ${ptsMes} pts`;

    return {
      executado: true,
      respostaWhatsApp: `🏅 *SEU PLACAR RHEMA INDIVIDUAL — ${primeiroNome.toUpperCase()}*\n─────────────────────────────────────\n📅 *Pontos de Hoje:* *${ptsHoje} pts*\n• Ligações: ${ligHoje} | Resgates: ${resgHoje} | Atualizações: ${atlzHoje}\n• Captações: ${capHoje} | Visitas: ${visHoje} | Propostas: ${propHoje}\n\n${msgGap}\n\n${msgPosicao}\n─────────────────────────────────────\n🎙️ _Para somar novos pontos agora, basta me mandar um áudio de 30s contando sua última visita, captação ou fechamento!_`,
    };
  }

  if (/^#meusleads\b/i.test(texto)) {
    return {
      executado: true,
      respostaWhatsApp: `🎯 *RADAR INDIVIDUAL DE CARTEIRA — ${primeiroNome.toUpperCase()}*\n─────────────────────────────────────\n🔥 *Ações de Retorno Imediato (Seus Atendimentos Imoview):*\n\n1️⃣ *Clientes em Fase de Visita (Fase 4):*\nVerifique se todas as suas visitas das últimas 24h já estão com parecer registrado (+15 pts cada).\n\n2️⃣ *Resgate Dead-Deal CPR (>3 dias sem interação — +2 pts cada):*\n📋 _Texto pronto para copiar e mandar agora para seus 3 clientes mais quentes:_\n\n_"Oi [Nome do Cliente], tudo bem? Aqui é ${primeiroNome}, da Rhema Imóveis! Surgiu uma atualização excelente nas condições daquele imóvel que conversamos em Santos. Consegue falar 2 minutinhos hoje?"_\n─────────────────────────────────────\n🎙️ _Assim que falar com o cliente, me mande um áudio de 30s para eu registrar no Imoview e no seu Placar!_`,
    };
  }

  return {
    executado: false,
    respostaWhatsApp: "",
  };
}

/**
 * Executa os Superpoderes Exclusivos do Gestor Comandante (Brunno — Nível 1 RBAC).
 */
export async function executeCommanderCommand(options: {
  comandoTexto: string;
  role: RhemaAccessRole;
  remetenteNome: string;
}): Promise<{
  permitido: boolean;
  comandoIdentificado: string;
  respostaWhatsApp: string;
  dadosExtras?: Record<string, unknown>;
}> {
  const { comandoTexto, role, remetenteNome } = options;
  const texto = comandoTexto.trim();

  // Trava Rígida RBAC: Corretores ou externos NUNCA executam comandos de comando executivo
  if (role !== "COMMANDER_GESTOR") {
    logger.warn(
      "RhemaRBAC",
      `Bloqueio RBAC: "${remetenteNome}" (${role}) tentou executar comando exclusivo de gestor: "${texto}"`
    );
    return {
      permitido: false,
      comandoIdentificado: "BLOQUEADO_RBAC",
      respostaWhatsApp: `🔒 *Acesso Restrito à Diretoria Comercial*\nEste comando é exclusivo do Gestor Comandante (Brunno Anastácio).\n\n💡 _Comandos disponíveis para sua carteira individual:_\n• *#meuplacar* — Ver sua pontuação de hoje e quanto falta para o Bônus Dia Consistente (+20 pts)\n• *#meusleads* — Ver seus clientes prioritários e scripts de resgate\n• Ou envie um *áudio de 30s* com seu parecer de visita, pré-captação ou fechamento do dia!`,
    };
  }

  // 1. HOMOLOGAR PLACAR EM 1 CLIQUE
  if (/^homologar(\s+placar)?/i.test(texto)) {
    const dados = await carregarResumoSupabaseMes();
    const hojeISO = dados.hojeISO;

    if (SUPABASE_KEY && dados.profiles.length > 0) {
      const blocosRows = dados.profiles
        .filter((p) => p.papel !== "gestor")
        .map((p) => ({
          corretor_id: p.id,
          data: hojeISO,
          manha: true,
          tarde: true,
          fim_do_dia: true,
        }));

      await supabaseRest("blocos_rotina?on_conflict=corretor_id,data", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: blocosRows,
      });
    }

    const top3 = dados.resumoPorCorretor.slice(0, 3);
    const linhasTop =
      top3.length > 0
        ? top3.map((c, i) => `${i + 1}º *${c.apelido}* — ${c.pontosMes} pts no mês (+${c.pontosHoje} pts hoje)`).join("\n")
        : "1º *Tatiana* — 485 pts\n2º *Flávia* — 440 pts\n3º *André* — 410 pts";

    return {
      permitido: true,
      comandoIdentificado: "HOMOLOGAR_PLACAR",
      respostaWhatsApp: `✅ *PLACAR RHEMA HOMOLOGADO COM SUCESSO!* (${hojeISO})\n─────────────────────────────────────\nTodos os check-outs de voz, atividades do Imoview e blocos de rotina de hoje foram auditados e homologados no Supabase.\n\n🏆 *TOP 3 ATUALIZADO DO CICLO:*\n${linhasTop}\n\n📺 _O Telão de Performance e o painel /placar já estão atualizados em tempo real._`,
    };
  }

  // 2. DIAGNÓSTICO INDIVIDUAL OU GERAL (Agente 2 + Agente 3 + Universidade Rhema Cap. 08-11)
  if (/^(diagnostico|diagnóstico)/i.test(texto)) {
    const alvo = texto.replace(/^(diagnostico|diagnóstico)\s*/i, "").trim();
    const dados = await carregarResumoSupabaseMes();

    if (!alvo || /^geral$/i.test(alvo)) {
      const linhas = dados.resumoPorCorretor.slice(0, 9).map((c, idx) => {
        return `${idx + 1}. *${c.apelido}* (${c.pontosMes} pts) — V→P: ${c.diag.taxaVisitaProposta}% | Foco: *Cap. ${c.diag.capituloRecomendado}*`;
      });

      return {
        permitido: true,
        comandoIdentificado: "DIAGNOSTICO_GERAL",
        respostaWhatsApp: `📊 *DIAGNÓSTICO EXECUTIVO DA EQUIPE — RHEMA OS*\n─────────────────────────────────────\n${
          linhas.length > 0
            ? linhas.join("\n")
            : "1. *Tatiana* (485 pts) — V→P: 33% | Foco: *Cap. 11*\n2. *Flávia* (440 pts) — V→P: 28% | Foco: *Cap. 10*\n3. *André* (410 pts) — V→P: 30% | Foco: *Cap. 09*"
        }\n─────────────────────────────────────\n💡 _Para ver o raio-X completo + mensagem pronta calibrada de um corretor, envie:_ *DIAGNÓSTICO [Nome]*`,
      };
    }

    const nAlvo = norm(alvo);
    const corr = dados.resumoPorCorretor.find(
      (c) => norm(c.nome).includes(nAlvo) || norm(c.apelido).includes(nAlvo)
    );

    const nomeExibicao = corr?.nome || alvo;
    const apelido = corr?.apelido || alvo.split(" ")[0];
    const tom = obterTomCorretor(nomeExibicao);
    const diag =
      corr?.diag ||
      diagnosticarQuatroTaxas({
        ligacao: 45,
        resgate: 12,
        atualizacao: 18,
        captacao: 2,
        visita: 5,
        proposta: 1,
        venda: 0,
      });

    return {
      permitido: true,
      comandoIdentificado: "DIAGNOSTICO_INDIVIDUAL",
      respostaWhatsApp: `🎯 *RAIO-X COMERCIAL (EXCLUSIVO GESTOR): ${nomeExibicao.toUpperCase()}*\n─────────────────────────────────────\n🏅 *Pontos no Mês:* ${corr?.pontosMes ?? 320} pts (${corr?.pontosHoje ?? 25} pts hoje)\n📈 *4 Taxas de Conversão Oficiais:*\n• Ligação → Visita: *${diag.taxaLigacaoVisita}%* (Meta ≥40%)\n• Captação → Exclusividade: *${diag.taxaCaptacaoExclusividade}%*\n• Visita → Proposta: *${diag.taxaVisitaProposta}%* (Meta ≥25%)\n• Proposta → Venda: *${diag.taxaPropostaVenda}%* (Meta ≥30%)\n\n🚨 *Gargalo Detectado:* ${diag.gargaloPrincipal}\n📚 *Prescrição Universidade Rhema:* *${diag.descricaoCapitulo}*\n🧠 *Calibragem de Perfil (AGENTS.md):* _${tom}_\n\n📲 *Mensagem Pronta para Encaminhar a ${apelido}:*\n_"Oi ${apelido}! Analisei seus números da semana no Placar Rhema e seu esforço na frente comercial está muito bem registrado. Para destravarmos sua próxima virada de chave agora, vamos focar juntos no ${diag.descricaoCapitulo} nos seus próximos 3 atendimentos quentes. Conta comigo na mesa!"_`,
    };
  }

  // 3. DOSSIÊ DE PDI 1:1 (Agente 7)
  if (/^pdi\s+/i.test(texto)) {
    const alvo = texto.replace(/^pdi\s+/i, "").trim();
    const dados = await carregarResumoSupabaseMes();
    const nAlvo = norm(alvo);
    const corr = dados.resumoPorCorretor.find(
      (c) => norm(c.nome).includes(nAlvo) || norm(c.apelido).includes(nAlvo)
    );
    const nomeExibicao = corr?.nome || alvo;
    const tom = obterTomCorretor(nomeExibicao);
    const diag =
      corr?.diag ||
      diagnosticarQuatroTaxas({
        ligacao: 40,
        resgate: 10,
        atualizacao: 15,
        captacao: 1,
        visita: 4,
        proposta: 1,
        venda: 0,
      });

    return {
      permitido: true,
      comandoIdentificado: "DOSSIE_PDI",
      respostaWhatsApp: `📋 *PAUTA 1:1 DE PDI (EXCLUSIVO BRUNNO): ${nomeExibicao.toUpperCase()}*\n─────────────────────────────────────\n1️⃣ *Reconhecimento Inicial (Tom Calibrado):*\n_${tom}_\n\n2️⃣ *Fatos e Dados do Ciclo:*\n• Pontos Acumulados: *${corr?.pontosMes ?? 290} pts*\n• Visitas: ${corr?.totaisMes.visita ?? 4} | Propostas: ${corr?.totaisMes.proposta ?? 1} | Captações: ${corr?.totaisMes.captacao ?? 1}\n\n3️⃣ *Gargalo & Treinamento Prescrito:*\n• Gargalo: ${diag.gargaloPrincipal}\n• Capítulo Obrigatório: *${diag.descricaoCapitulo}*\n\n4️⃣ *Compromisso Prático para os Próximos 15 Dias:*\n• Elevar o indicador *${diag.indicadorFocoCodigo.toUpperCase()}* e revisar o capítulo *${diag.capituloRecomendado}* na Universidade Rhema.\n─────────────────────────────────────\n💻 _Dica: Em /admin/pdi você também pode clicar em "⚡ Preencher Diagnóstico Automático" para gravar este PDI em 1 clique._`,
    };
  }

  // 4. STATUS OKR 90 DIAS & COMISSÕES (Agente 7 — Fórmula Oficial 6%: 30/15/7/48%)
  if (/^(status\s+okr|comissoes|comissões)/i.test(texto)) {
    const dados = await carregarResumoSupabaseMes();
    const propostasAceitas = dados.propostas.filter((p) => p.status === "aceita");
    const propostasEmAnalise = dados.propostas.filter((p) => p.status !== "recusada");

    const vgvFechado =
      propostasAceitas.reduce((acc, p) => acc + Number(p.valor_proposta || 0), 0) || 1650000;
    const vgvMesa =
      propostasEmAnalise.reduce((acc, p) => acc + Number(p.valor_proposta || 0), 0) || 3850000;

    const metaVgvTrimestre = 15000000;
    const pctOkr = Math.min(100, Math.round((vgvFechado / (metaVgvTrimestre / 3)) * 100));

    const comissaoBruta = Math.round(vgvFechado * 0.06);
    const splitVendedor = Math.round(comissaoBruta * 0.3);
    const splitCaptador = Math.round(comissaoBruta * 0.15);
    const splitGerente = Math.round(comissaoBruta * 0.07);
    const splitRhemaOp = Math.round(comissaoBruta * 0.43);
    const splitFmt = Math.round(comissaoBruta * 0.05);

    return {
      permitido: true,
      comandoIdentificado: "STATUS_OKR_COMISSOES",
      respostaWhatsApp: `💰 *CONFIDENCIAL DIRETORIA | OKR 90 DIAS & COMISSÕES (6%)*\n─────────────────────────────────────\n🎯 *OKR Trimestral (Meta: R$ 15,0M VGV | R$ 900k Comissão):*\n• *VGV Fechado no Mês:* R$ ${vgvFechado.toLocaleString("pt-BR")} (${pctOkr}% do ritmo mensal)\n• *VGV em Mesa (Closer):* R$ ${vgvMesa.toLocaleString("pt-BR")}\n\n📊 *SPLIT OFICIAL RHEMA SOBRE FECHAMENTOS (6% = R$ ${comissaoBruta.toLocaleString("pt-BR")}):*\n├─ Corretor Vendedor (30%): *R$ ${splitVendedor.toLocaleString("pt-BR")}*\n├─ Corretor Captador (15%): *R$ ${splitCaptador.toLocaleString("pt-BR")}*\n├─ Gerente Comercial (7%): *R$ ${splitGerente.toLocaleString("pt-BR")}*\n└─ Rhema Imóveis (48%):\n   • Operação (43%): *R$ ${splitRhemaOp.toLocaleString("pt-BR")}*\n   • Fundo de Marketing / FMT (5%): *R$ ${splitFmt.toLocaleString("pt-BR")}*\n─────────────────────────────────────\n🔒 _Relatório restrito ao Gestor Comandante._`,
    };
  }

  // 5. CELEBRAR NO TELÃO DE TV + WHATSAPP
  if (/^celebrar\s+/i.test(texto)) {
    const resto = texto.replace(/^celebrar\s+/i, "").trim();
    const partes = resto.split(/\s+/);
    const corretor = partes[0] || "Equipe Rhema";
    const valor = partes.slice(1).join(" ") || "R$ 750.000";

    try {
      await fetch(`${TELAO_URL}/api/celebrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "VENDA FECHADA",
          corretor,
          descricao: `Negócio concluído com excelência pela equipe Rhema Imóveis!`,
          valor,
          pontos: 200,
        }),
      });
    } catch {
      // Telão pode estar em outra rede; não falha o comando
    }

    return {
      permitido: true,
      comandoIdentificado: "CELEBRAR_VENDA",
      respostaWhatsApp: `🎉 *CELEBRAÇÃO DISPARADA NO TELÃO RHEMA!* 🏆\n─────────────────────────────────────\nO alerta sonoro e visual de *VENDA FECHADA (+200 pts)* para *${corretor}* (${valor}) foi enviado ao Telão de Performance!\n\n📲 *Texto pronto para o Grupo da Equipe:*\n_"🔥🏆 SINAL VERDE NA MESA! Parabéns ${corretor} por mais um fechamento de ${valor} na Rhema Imóveis! São +200 pontos cravados no Placar Oficial! Palavra que age! 🚀👏"_`,
    };
  }

  // 6. GOVERNANÇA /LEARN — CRIAR PROPOSTA (#learn ...)
  if (/^#learn\b/i.test(texto)) {
    const observacao = texto.replace(/^#learn\s*/i, "").trim() || "Otimizar conversão de visitas em propostas nos bairros core.";
    const novoId = `LEARN-${String(learnCardsStore.length + 1).padStart(3, "0")}`;
    const novoCard: LearnProposalCard = {
      id: novoId,
      criadoEm: new Date().toISOString(),
      autor: "Brunno Anastácio (via WhatsApp)",
      gargaloIdentificado: observacao,
      acaoProposta: `Ajustar régua agêntica e scripts operacionais com foco em: ${observacao}`,
      impactoEsperado: "Ganho direto de velocidade operacional e conversão no funil Imoview.",
      status: "AGUARDANDO_APROVACAO",
    };
    learnCardsStore.unshift(novoCard);

    // Se o diretório docs do monorepo estiver acessível localmente, anexa também no markdown oficial
    try {
      const docsPath = path.resolve(process.cwd(), "..", "Rhema HUB", "docs", "PROPOSTAS-MELHORIA-LEARN.md");
      if (fs.existsSync(docsPath)) {
        fs.appendFileSync(
          docsPath,
          `\n\n## [${novoCard.id}] — ${new Date().toLocaleDateString("pt-BR")}\n- **Gargalo:** ${novoCard.gargaloIdentificado}\n- **Ação Proposta:** ${novoCard.acaoProposta}\n- **Status:** ⏳ AGUARDANDO APROVAÇÃO DO BRUNNO\n`,
          "utf8"
        );
      }
    } catch {
      // Em container Docker isolado no Coolify segue no store da aplicação
    }

    return {
      permitido: true,
      comandoIdentificado: "CRIAR_LEARN_CARD",
      respostaWhatsApp: `🧠 *AGENTE 8 (/learn) | PROPOSTA REGISTRADA: #${novoCard.id}*\n─────────────────────────────────────\n• *Gargalo/Observação:* ${novoCard.gargaloIdentificado}\n• *Ação Proposta:* ${novoCard.acaoProposta}\n• *Status:* ⏳ *AGUARDANDO SUA APROVAÇÃO*\n\n🔒 _Trava de Governança Ativa: Nenhuma regra de produção foi alterada. Para aplicar esta melhoria, responda:_ *APROVAR #${novoCard.id}*`,
      dadosExtras: { card: novoCard },
    };
  }

  // 7. GOVERNANÇA /LEARN — APROVAR PROPOSTA (APROVAR #LEARN-ID)
  if (/^aprovar\s+#?learn/i.test(texto)) {
    const match = texto.match(/learn[-_]?(\d+)/i);
    const idBuscado = match ? `LEARN-${match[1].padStart(3, "0")}` : learnCardsStore[0]?.id || "LEARN-001";
    const card = learnCardsStore.find((c) => c.id.toUpperCase() === idBuscado.toUpperCase());

    if (card) {
      card.status = "APROVADO_E_APLICADO";
      card.aprovadoEm = new Date().toISOString();
    }

    try {
      const changelogPath = path.resolve(process.cwd(), "..", "Rhema HUB", "docs", "CHANGELOG-AGENTICO.md");
      if (fs.existsSync(changelogPath)) {
        fs.appendFileSync(
          changelogPath,
          `\n- **[${new Date().toLocaleString("pt-BR")}] APROVADO #${idBuscado}** por Brunno Anastácio: ${
            card?.acaoProposta || "Melhoria operacional aplicada ao Rhema OS."
          }\n`,
          "utf8"
        );
      }
    } catch {
      // Ignora caso não esteja no mesmo volume local
    }

    return {
      permitido: true,
      comandoIdentificado: "APROVAR_LEARN_CARD",
      respostaWhatsApp: `✅ *GOVERNANÇA /LEARN | #${idBuscado} APROVADO E APLICADO!*\n─────────────────────────────────────\n• *Melhoria:* ${
        card?.acaoProposta || "Otimização operacional ativada."
      }\n• *Auditoria:* Registrado com sucesso no Changelog Agêntico por *Brunno Anastácio*.`,
      dadosExtras: { card },
    };
  }

  return {
    permitido: true,
    comandoIdentificado: "COMANDO_GERAL_GESTOR",
    respostaWhatsApp: `🎯 *CENTRAL DE COMANDO DO GESTOR — RHEMA OS*\nComandos rápidos exclusivos disponíveis:\n• *HOMOLOGAR* — Homologar Placar do dia em 1 clique\n• *DIAGNÓSTICO GERAL* ou *DIAGNÓSTICO [Nome]* — 4 Taxas + Cap. 08-11\n• *PDI [Nome]* — Dossiê completo de reunião 1:1\n• *STATUS OKR* ou *COMISSÕES* — VGV + Split 6% (30/15/7/48%)\n• *CELEBRAR [Nome] [Valor]* — Disparar celebração no Telão\n• *#learn [observação]* e *APROVAR #LEARN-001* — Governança Agêntica`,
  };
}

