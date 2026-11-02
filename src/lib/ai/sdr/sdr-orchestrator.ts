import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { parseSdrIntakeMessage, normalizeBrPhone } from "./intake-parser";
import { findMatchingAlternativeProperties, SdrPropertyOption, formatPropertyDetailsUrl } from "./property-matcher";
import { assignBrokerForLead } from "./broker-assignment";
import { checkExistingLeadInImoview, registerSdrAttendanceInImoview } from "@/lib/imoview-sdr";
import { notifyBrokerAndGroup } from "./broker-notifier";
import { evaluateAndRecordLeadLearning } from "./sdr-learner";
import { callModelRouter } from "../model-router";
import { SDR_LEAD_SYSTEM_PROMPT, SDR_OWNER_SYSTEM_PROMPT } from "./sdr-prompts";
import { isWithinBusinessHours, scheduleNextFollowup } from "./sdr-followup";

export interface InboundSdrResult {
  handled: boolean;
  replySent?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 1. Processa mensagens de entrada postadas pela Camila no Grupo Rhema SDR
 */
export async function handleGroupIntakeMessage(sock: any, msg: any, text: string): Promise<boolean> {
  const intakeId = msg?.key?.id || String(Date.now());
  const groupJid = msg?.key?.remoteJid;

  logger.info("SdrOrchestrator", `Mensagem recebida no grupo Rhema SDR (${groupJid}): "${text.slice(0, 100)}"`);

  // Idempotência
  const existingLead = await prisma.sdrLead.findUnique({
    where: { intakeMessageId: intakeId },
  });
  if (existingLead) {
    logger.info("SdrOrchestrator", `Mensagem ${intakeId} já processada anteriormente.`);
    return true;
  }

  // Parse dos dados do lead
  const parsed = await parseSdrIntakeMessage(text);
  if (!parsed.success) {
    if (parsed.messageToGroupIfInvalid) {
      await sock.sendMessage(groupJid, { text: parsed.messageToGroupIfInvalid }, { quoted: msg });
    }
    return true;
  }

  const { leadNome, leadPhone, leadJid, codigoImovel, origem, observacoes } = parsed;

  // 1. Checagem de Trava LEAD CORRETOR e Duplicidade no Imoview
  const imoviewCheck = await checkExistingLeadInImoview(leadPhone);
  if (imoviewCheck.hasExistingAttendance && imoviewCheck.isLeadCorretor) {
    const blindagemAviso =
      `🛡️ *TRAVA LEAD CORRETOR ACIONADA:* O cliente *${leadNome}* (${leadPhone}) já possui atendimento ativo no Imoview com o corretor titular *${imoviewCheck.corretorNome || "Corretor"}*.\n` +
      `Conforme as regras inegociáveis da Diretoria Rhema, este contato pertence com exclusividade ao titular e *NÃO será redistribuído*. O corretor titular foi preservado!`;

    await sock.sendMessage(groupJid, { text: blindagemAviso }, { quoted: msg });
    return true;
  }

  // 2. Buscar snapshot do imóvel e contato do proprietário no cache/banco
  let imovelSnapshot: any = null;
  let ownerPhone: string | null = null;
  let ownerNome: string | null = null;

  if (codigoImovel) {
    try {
      const cached = await prisma.imoviewContactContext.findFirst({
        where: { codigoImovel: String(codigoImovel) },
      });
      if (cached) {
        imovelSnapshot = {
          codigo: cached.codigoImovel,
          bairro: cached.bairro,
          tipo: cached.tipoImovel,
          valor: cached.valor,
          condominio: cached.valorCondominio,
          iptu: cached.valorIptu,
          corretorNome: cached.corretorNome,
        };
        if (cached.tipoRelacionamento === "proprietario" && cached.phone) {
          ownerPhone = cached.phone;
          ownerNome = cached.nome;
        }
      }
    } catch (dbErr) {
      logger.warn("SdrOrchestrator", "Aviso ao buscar snapshot do imóvel:", dbErr);
    }
  }

  // 3. Criar registro do SdrLead no banco
  const sdrLead = await prisma.sdrLead.create({
    data: {
      leadNome,
      leadPhone,
      leadJid,
      origem: origem || "Portal",
      codigoImovel,
      imovelSnapshot: imovelSnapshot || undefined,
      observacoesCamila: observacoes,
      rawIntakeText: text,
      intakeMessageId: intakeId,
      status: isWithinBusinessHours() ? "CONTACTED" : "QUEUED_FOR_MORNING",
      temperatura: "MORNO",
      ownerPhone: ownerPhone || undefined,
      ownerStatus: ownerPhone ? "PENDING" : "UNAVAILABLE",
      sessionId: process.env.RHEMA_SDR_SESSION_ID || "5mhrx9",
    },
  });

  // Cria conversa com o Lead
  const leadConv = await prisma.sdrConversation.create({
    data: {
      sdrLeadId: sdrLead.id,
      role: "LEAD",
      jid: leadJid,
      phone: leadPhone,
      status: "ACTIVE",
    },
  });

  const primeiroNome = leadNome.split(" ")[0] || "tudo bem";
  const bairroTxt = imovelSnapshot?.bairro ? ` no ${imovelSnapshot.bairro}` : " em Santos";

  // 4. Se estiver em horário comercial, envia o 1º contato imediato com split e digitação
  if (isWithinBusinessHours()) {
    const aberturaBubbles = [
      `Oi ${primeiroNome}! Tudo bem? Vi seu interesse no apê cód. #${codigoImovel || "6430"}${bairroTxt}. 😊`,
      `Para eu já te passar os detalhes certos: você busca pra moradia com a família ou pensa em investimento?`,
    ];

    try {
      await sendHumanBubblesWithTyping({
        sock,
        toJid: leadJid,
        bubbles: aberturaBubbles,
        conversationId: leadConv.id,
        modelUsed: "opening-split",
      });
      logger.info("SdrOrchestrator", `Primeiro contato splitado enviado para o lead ${leadNome} (${leadJid}).`);
      // Agenda 1º toque da régua anti-vácuo (+45m)
      await scheduleNextFollowup(sdrLead.id, 0);
    } catch (leadSendErr) {
      logger.error("SdrOrchestrator", `Erro ao enviar WhatsApp ao lead ${leadJid}:`, leadSendErr);
    }
  } else {
    logger.info("SdrOrchestrator", `Lead ${leadNome} recebido fora do horário comercial. Enfileirado para 07:45.`);
  }

  // 5. Se tiver telefone do proprietário e estiver em horário comercial, consulta janela de visita
  if (ownerPhone && isWithinBusinessHours()) {
    const { jid: ownerJid } = normalizeBrPhone(ownerPhone);
    const ownerConv = await prisma.sdrConversation.create({
      data: {
        sdrLeadId: sdrLead.id,
        role: "OWNER",
        jid: ownerJid,
        phone: ownerPhone,
        status: "ACTIVE",
      },
    });

    const propNome = ownerNome ? ownerNome.split(" ")[0] : "tudo bem";
    const msgAberturaProprietario =
      `Olá, ${propNome}! Tudo bem? Aqui é da Rhema Imóveis.\n\n` +
      `Temos um cliente qualificado em atendimento com interesse real no seu imóvel cód. ${codigoImovel}${bairroTxt}.\n\n` +
      `Para organizarmos uma visita nesta semana, quais dias e horários costumam ser mais tranquilos para você?`;

    try {
      await sock.sendMessage(ownerJid, { text: msgAberturaProprietario });
      await prisma.sdrMessage.create({
        data: {
          conversationId: ownerConv.id,
          direction: "OUT",
          content: msgAberturaProprietario,
          modelUsed: "owner-opening-template",
        },
      });
      logger.info("SdrOrchestrator", `Consulta de visita enviada ao proprietário (${ownerJid}).`);
    } catch (ownerSendErr) {
      logger.warn("SdrOrchestrator", "Aviso ao contatar proprietário:", ownerSendErr);
    }
  }

  // 6. Confirmação no Grupo Rhema SDR
  const statusGrupoTexto = isWithinBusinessHours()
    ? `💬 *Status:* Contato aberto no WhatsApp e qualificação dos 4 pilares em andamento.\n` +
      `${ownerPhone ? "🏢 *Proprietário:* Consultado sobre janelas de visita.\n" : "ℹ️ *Proprietário:* Telefone não vinculado — priorizando alternativas e qualificação.\n"}`
    : `🌙 *Status:* Registrado no sistema! Primeiro contato humano agendado para as *07:45 da manhã* para não incomodar o cliente fora de hora.\n`;

  const confirmaGrupo =
    `🎯 *LEAD RECEBIDO & REGISTRADO NO RHEMA SDR!* ⚡\n` +
    `─────────────────────────────────────\n` +
    `👤 *Cliente:* ${leadNome} (${leadPhone})\n` +
    `🏠 *Imóvel:* #${codigoImovel || "N/A"}${bairroTxt}\n` +
    `📍 *Origem:* ${origem || "Portal"}\n` +
    statusGrupoTexto +
    `─────────────────────────────────────`;

  await sock.sendMessage(groupJid, { text: confirmaGrupo }, { quoted: msg });
  return true;
    `👤 *Cliente:* ${leadNome} (${leadPhone})\n` +
    `🏠 *Imóvel:* #${codigoImovel || "N/A"}${bairroTxt}\n` +
    `📍 *Origem:* ${origem || "Portal"}\n` +
    `💬 *Status:* Contato aberto no WhatsApp e qualificação dos 4 pilares em andamento.\n` +
    `${ownerPhone ? "🏢 *Proprietário:* Consultado sobre janelas de visita.\n" : "ℹ️ *Proprietário:* Telefone não vinculado — priorizando alternativas e qualificação.\n"}` +
    `─────────────────────────────────────`;

  await sock.sendMessage(groupJid, { text: confirmaGrupo }, { quoted: msg });
  return true;
}

/**
 * 2. Processa mensagens privadas enviadas pelo Lead ou pelo Proprietário
 */
export async function handleInboundSdrMessage(params: {
  sock: any;
  remoteJid: string;
  cleanPhone: string;
  text: string;
}): Promise<InboundSdrResult> {
  const { sock, remoteJid, cleanPhone, text } = params;

  // Busca conversa ativa
  const conv = await prisma.sdrConversation.findFirst({
    where: {
      OR: [{ jid: remoteJid }, { phone: cleanPhone }],
      status: "ACTIVE",
    },
    include: {
      sdrLead: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });

  if (!conv || !conv.sdrLead) {
    return { handled: false };
  }

  const sdrLead = conv.sdrLead;

  // Salva mensagem recebida no histórico
  await prisma.sdrMessage.create({
    data: {
      conversationId: conv.id,
      direction: "IN",
      content: text,
    },
  });

  // Ramo A: Conversa com o LEAD
  if (conv.role === "LEAD") {
    return handleLeadTurn({ sock, conv, sdrLead, text });
  }

  // Ramo B: Conversa com o PROPRIETÁRIO
  if (conv.role === "OWNER") {
    return handleOwnerTurn({ sock, conv, sdrLead, text });
  }

  return { handled: false };
}

/**
 * Processa o turno de diálogo com o LEAD
 */
async function handleLeadTurn(params: { sock: any; conv: any; sdrLead: any; text: string }): Promise<InboundSdrResult> {
  const { sock, conv, sdrLead, text } = params;

  // Histórico em ordem cronológica
  const history = [...(conv.messages || [])].reverse().map((m: any) => ({
    role: m.direction === "OUT" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  const imovelSnapshot = sdrLead.imovelSnapshot as any;
  const ownerStatus = sdrLead.ownerStatus;
  const ownerWindows = (sdrLead.ownerWindows as string[]) || [];

  let contextPrompt =
`DADOS DO LEAD E CONTEXTO ATUAL:
- Nome do Lead: ${sdrLead.leadNome}
- Imóvel de Interesse: #${sdrLead.codigoImovel || "Aberto"} (${imovelSnapshot?.bairro || "Santos"}, ${imovelSnapshot?.tipo || "Apartamento"}, Valor: ${imovelSnapshot?.valor || "Sob consulta"})
- Status do Proprietário do Imóvel: ${ownerStatus}
- Janelas de Visita Informadas pelo Proprietário: ${ownerWindows.length > 0 ? ownerWindows.join(", ") : "Ainda não confirmadas"}
`;

  // Se o imóvel estiver indisponível ou vendido (Regra 6 do usuário)
  if (ownerStatus === "UNAVAILABLE" || ownerStatus === "SOLD") {
    const alternativas = await findMatchingAlternativeProperties({
      imovelOrigemCodigo: sdrLead.codigoImovel || undefined,
      bairro: imovelSnapshot?.bairro || "Santos",
      tipoImovel: imovelSnapshot?.tipo || "Apartamento",
      valorNumerico: imovelSnapshot?.valorNumerico || 0,
    });

    contextPrompt +=
`\n🚨 ATENÇÃO: O imóvel original #${sdrLead.codigoImovel} está INDISPONÍVEL (${ownerStatus}).
Para não frustrar o lead, explique com honestidade e acolhimento e ofereça as seguintes opções reais da Rhema no mesmo perfil:
${alternativas.map((a, i) => `${i + 1}. Cód. ${a.codigo} - ${a.titulo} (${a.bairro}): ${a.valorFormatado} - Link: ${a.linkRhema}`).join("\n")}
Caso o cliente prefira, ofereça também conectar diretamente com nosso especialista do bairro para opções off-market exclusivas.`;
  }

  const result = await callModelRouter({
    task: "LEAD_CHAT",
    messages: [
      { role: "system", content: `${SDR_LEAD_SYSTEM_PROMPT}\n\n${contextPrompt}` },
      ...history,
      { role: "user", content: text },
    ],
    jsonMode: true,
  });

  const parsed = result.jsonParsed || {};
  const replyParts: string[] = Array.isArray(parsed.replyParts) && parsed.replyParts.length > 0
    ? parsed.replyParts
    : ["Perfeito! Entendi o seu ponto. E com relação à localização, o bairro atende bem à sua rotina?"];

  // Atualiza estado do lead no banco
  const updatedPilares = {
    ...(sdrLead.pilares as any || {}),
    ...(parsed.pilares || {}),
  };

  await prisma.sdrLead.update({
    where: { id: sdrLead.id },
    data: {
      pilares: updatedPilares,
      temperatura: parsed.temperatura || sdrLead.temperatura,
      perfilExtraido: parsed.perfilExtraido || sdrLead.perfilExtraido,
    },
  });

  // Se o lead confirmou interesse em visitar ou se a visita foi acordada
  if (parsed.intencaoVisita || parsed.proximoPasso === "TRANSBORDO_CORRETOR" || parsed.horarioSugeridoPeloLead) {
    await finalizarAgendamentoETransferencia({
      sock,
      sdrLeadId: sdrLead.id,
      horarioEscolhido: parsed.horarioSugeridoPeloLead || "A combinar conforme janelas",
      temperatura: parsed.temperatura || sdrLead.temperatura || "QUENTE",
    });
  }

  // Envia resposta em cadência natural splitada com presença de digitação
  await sendHumanBubblesWithTyping({
    sock,
    toJid: conv.jid,
    bubbles: replyParts,
    conversationId: conv.id,
    modelUsed: result.modelUsed,
  });

  // Agenda T1 da régua anti-vácuo (+45 min caso o lead não responda mais)
  scheduleNextFollowup(sdrLead.id, 0).catch(() => {});

  return { handled: true, replySent: true };
}

/**
 * Processa o turno de diálogo com o PROPRIETÁRIO
 */
async function handleOwnerTurn(params: { sock: any; conv: any; sdrLead: any; text: string }): Promise<InboundSdrResult> {
  const { sock, conv, sdrLead, text } = params;

  const history = [...(conv.messages || [])].reverse().map((m: any) => ({
    role: m.direction === "OUT" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  const result = await callModelRouter({
    task: "OWNER_CHAT",
    messages: [
      { role: "system", content: SDR_OWNER_SYSTEM_PROMPT },
      ...history,
      { role: "user", content: text },
    ],
    jsonMode: true,
  });

  const parsed = result.jsonParsed || {};
  const replyParts: string[] = Array.isArray(parsed.replyParts) && parsed.replyParts.length > 0
    ? parsed.replyParts
    : [parsed.replyText || "Muito obrigado pelas informações! Já anotei aqui com a nossa equipe."];
  const ownerStatus = parsed.ownerStatus || "WINDOWS_OK";
  const janelas = parsed.janelasDisponiveis || [];
  const alteracoes = parsed.alteracoesCadastrais || {};

  // Atualiza estado do proprietário e snapshot de valores no lead
  await prisma.sdrLead.update({
    where: { id: sdrLead.id },
    data: {
      ownerStatus,
      ownerWindows: janelas,
      imovelSnapshot: alteracoes.novoValorVenda
        ? {
            ...(typeof sdrLead.imovelSnapshot === "object" && sdrLead.imovelSnapshot !== null ? sdrLead.imovelSnapshot : {}),
            valorVendaAtualizado: alteracoes.novoValorVenda,
            condominioAtualizado: alteracoes.novoCondominio,
            iptuAtualizado: alteracoes.novoIptu,
          }
        : undefined,
    },
  });

  // Envia resposta em bolhas naturais para o proprietário
  await sendHumanBubblesWithTyping({
    sock,
    toJid: conv.jid,
    bubbles: replyParts,
    conversationId: conv.id,
    modelUsed: result.modelUsed,
  });

  // 1. Variável WINDOWS_OK: Proprietário informou janelas -> propõe horários ao lead
  if (ownerStatus === "WINDOWS_OK" && janelas.length > 0) {
    const leadConv = await prisma.sdrConversation.findFirst({
      where: { sdrLeadId: sdrLead.id, role: "LEAD", status: "ACTIVE" },
    });

    if (leadConv) {
      const bubble1 = `Ótima notícia! Acabei de alinhar com o proprietário do imóvel cód. ${sdrLead.codigoImovel || ""}.`;
      const bubble2 = `Ele disponibilizou as seguintes janelas:\n• ${janelas.slice(0, 2).join("\n• ")}\n\nQual dessas fica melhor para a sua agenda?`;

      await sleep(1500);
      await sendHumanBubblesWithTyping({
        sock,
        toJid: leadConv.jid,
        bubbles: [bubble1, bubble2],
        conversationId: leadConv.id,
        modelUsed: "owner-windows-sync",
      });
    }
  }

  // 2. Variável SOLD / UNAVAILABLE / RENTED: Contingência Comercial (Regra 6)
  if (["SOLD", "UNAVAILABLE", "RENTED"].includes(ownerStatus)) {
    const leadConv = await prisma.sdrConversation.findFirst({
      where: { sdrLeadId: sdrLead.id, role: "LEAD", status: "ACTIVE" },
    });

    if (leadConv) {
      const { findMatchingAlternativeProperties } = await import("./property-matcher");
      const snap = (sdrLead.imovelSnapshot as any) || {};
      const alternativas = await findMatchingAlternativeProperties({
        imovelOrigemCodigo: sdrLead.codigoImovel,
        bairro: snap.bairro,
        tipoImovel: snap.tipo,
        valorNumerico: snap.valor,
        quartosMin: snap.quartos,
        limite: 3,
      });

      const motivoTexto = ownerStatus === "SOLD" ? "acabou de ser vendido" : "foi retirado de venda temporariamente pelo proprietário";
      const bubble1 = `Oi ${sdrLead.leadNome}! Falei agora com o proprietário desse imóvel (cód. ${sdrLead.codigoImovel || ""}) e ele nos informou que o imóvel ${motivoTexto}.`;
      
      let bubble2 = "";
      if (alternativas.length > 0) {
        const links = alternativas.map((a) => `• ${a.titulo} no ${a.bairro} (${a.valorFormatado})\n  👉 ${a.linkRhema}`).join("\n\n");
        bubble2 = `Mas como já entendi o seu perfil, separei aqui ${alternativas.length} excelentes opções na mesma região:\n\n${links}\n\nQual dessas plantas te agrada mais?`;
      } else {
        bubble2 = `Mas como já entendi o seu perfil, estou buscando opções exclusivas semelhantes aqui no bairro. Me dá 1 minutinho que já te mando!`;
      }

      await sleep(2000);
      await sendHumanBubblesWithTyping({
        sock,
        toJid: leadConv.jid,
        bubbles: [bubble1, bubble2],
        conversationId: leadConv.id,
        modelUsed: "owner-contingency-sync",
      });

      // Atualiza o lead no CRM para registrar as alternativas
      await prisma.sdrLead.update({
        where: { id: sdrLead.id },
        data: {
          status: "QUALIFYING",
          alternativasEnviadas: alternativas.map((a) => a.codigo),
        },
      });
    }
  }

  return { handled: true, replySent: true };
}

function parseVisitDateTime(text: string): Date | null {
  if (!text) return null;
  const now = new Date();
  const lower = text.toLowerCase();

  let hour = 10;
  let minute = 0;
  const timeMatch = lower.match(/(\d{1,2}):(\d{2})|(\d{1,2})h(\d{2})?|às\s*(\d{1,2})/);
  if (timeMatch) {
    if (timeMatch[1]) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2] || "0", 10);
    } else if (timeMatch[3]) {
      hour = parseInt(timeMatch[3], 10);
      minute = parseInt(timeMatch[4] || "0", 10);
    } else if (timeMatch[5]) {
      hour = parseInt(timeMatch[5], 10);
    }
  }

  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  const diasSemana: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    terça: 2,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sábado: 6,
    sabado: 6,
  };

  let daySet = false;
  for (const [dia, num] of Object.entries(diasSemana)) {
    if (lower.includes(dia)) {
      const currentDay = now.getDay();
      let diff = num - currentDay;
      if (diff <= 0) diff += 7;
      target.setDate(now.getDate() + diff);
      daySet = true;
      break;
    }
  }

  if (!daySet) {
    if (lower.includes("amanhã") || lower.includes("amanha")) {
      target.setDate(now.getDate() + 1);
    } else if (!lower.includes("hoje")) {
      target.setDate(now.getDate() + 2);
    }
  }

  return target;
}

/**
 * Conclui o ciclo SDR: cadastra no Imoview, distribui pela fila e notifica corretor e grupo
 */
async function finalizarAgendamentoETransferencia(params: {
  sock: any;
  sdrLeadId: string;
  horarioEscolhido: string;
  temperatura: string;
}) {
  const { sdrLeadId, horarioEscolhido, temperatura } = params;

  const lead = await prisma.sdrLead.findUnique({
    where: { id: sdrLeadId },
  });
  if (!lead || lead.status === "CRM_REGISTERED" || lead.status === "HANDED_OFF") return;

  const imovelSnapshot = lead.imovelSnapshot as any;
  const pilares = (lead.pilares as any) || {};

  const dossieTexto =
    `• Finalidade: ${pilares.finalidadeCompra ? "Moradia Própria" : "Investimento / A definir"}\n` +
    `• Localização: ${pilares.aderenciaLocalizacao ? `Aderente ao ${imovelSnapshot?.bairro || "Bairro"}` : "Aberta a bairros vizinhos"}\n` +
    `• Prazo: ${pilares.momentoCompraPrazo ? "Curto Prazo (30 a 60 dias)" : "Em fase de pesquisa"}\n` +
    `• Condição Financeira: ${pilares.condicaoFinanceira ? "Validada / Financiamento ou Recursos Próprios" : "A alinhar na visita"}\n` +
    `• Observações da Camila: ${lead.observacoesCamila || "Sem notas adicionais"}`;

  // 1. Distribuição de Corretor (Fila de Rodízio / Meritocracia no vendas_rhema.db)
  const assignment = await assignBrokerForLead({
    leadNome: lead.leadNome,
    leadPhone: lead.leadPhone,
    imovelCodigo: lead.codigoImovel || undefined,
    captadorNome: imovelSnapshot?.corretorNome,
    temperatura,
  });

  // 2. Cadastro no Imoview até a fase de Visita Agendada (Fase 8)
  const imoviewResult = await registerSdrAttendanceInImoview({
    leadNome: lead.leadNome,
    leadTelefone: lead.leadPhone,
    codigoImovel: lead.codigoImovel || undefined,
    origem: lead.origem || "Portal",
    temperatura,
    dossieQualificacao: dossieTexto,
    corretorIdDestino: assignment.imoviewId,
    corretorNomeDestino: assignment.corretorNome,
    visitaAgendada: {
      dataHoraFormatada: horarioEscolhido,
      imovelCodigo: lead.codigoImovel || "0",
    },
  });

  const estimatedDate = parseVisitDateTime(horarioEscolhido);

  // 3. Atualizar SdrLead
  await prisma.sdrLead.update({
    where: { id: lead.id },
    data: {
      status: "HANDED_OFF",
      corretorId: assignment.imoviewId,
      corretorNome: assignment.corretorNome,
      criterioDistribuicao: assignment.criterio,
      imoviewAtendimento: imoviewResult.codigoAtendimento || undefined,
      visitaImovel: lead.codigoImovel,
      visitaDataHora: estimatedDate || undefined,
    },
  });

  // 4. Notificar Corretor no WhatsApp e Resumo no Grupo Rhema SDR
  await notifyBrokerAndGroup({
    corretorNome: assignment.corretorNome,
    corretorTelefone: assignment.telefone,
    criterioDistribuicao: assignment.criterio,
    leadNome: lead.leadNome,
    leadPhone: lead.leadPhone,
    codigoImovel: lead.codigoImovel || undefined,
    bairro: imovelSnapshot?.bairro || "Santos",
    visitaDataHoraFormatada: horarioEscolhido,
    imoviewAtendimentoId: imoviewResult.codigoAtendimento,
    temperatura,
    dossieQualificacao: dossieTexto,
    imovelIndisponivelAviso:
      lead.ownerStatus === "UNAVAILABLE" || lead.ownerStatus === "SOLD"
        ? `Imóvel #${lead.codigoImovel} foi informado pelo proprietário como ${lead.ownerStatus}. O lead foi acolhido e orientado para opções similares.`
        : undefined,
  });

  // 5. Acionar auto-avaliação do SDR para aprendizado contínuo (Regra 7)
  evaluateAndRecordLeadLearning(lead.id).catch((e) => {
    logger.warn("SdrOrchestrator", "Aviso no auto-aprendizado pós-atendimento:", e);
  });
}

/**
 * Envia mensagens no WhatsApp simulando digitação real ("composing") e cadência humana splitada
 */
export async function sendHumanBubblesWithTyping(params: {
  sock: any;
  toJid: string;
  bubbles: string[];
  conversationId?: string;
  modelUsed?: string;
}) {
  const { sock, toJid, bubbles, conversationId, modelUsed = "sdr-engine" } = params;

  for (let i = 0; i < bubbles.length; i++) {
    const text = bubbles[i]?.trim();
    if (!text) continue;

    // 1. Ativa presença de "digitando..."
    try {
      await sock.sendPresenceUpdate("composing", toJid);
    } catch {}

    // 2. Tempo de digitação proporcional ao texto (mín 1.2s, máx 2.5s)
    const typingTime = Math.min(Math.max(text.length * 30, 1200), 2500);
    await sleep(typingTime);

    // 3. Envia o balão de mensagem (o envio automaticamente encerra o estado "digitando" no WhatsApp)
    await sock.sendMessage(toJid, { text });

    // 5. Registra no banco de histórico se houver conversationId
    if (conversationId) {
      prisma.sdrMessage
        .create({
          data: {
            conversationId,
            direction: "OUT",
            content: text,
            modelUsed,
          },
        })
        .catch(() => {});
    }

    // 6. Pequena pausa natural entre balões consecutivos (leitura do usuário)
    if (i < bubbles.length - 1) {
      await sleep(1000 + Math.random() * 500);
    }
  }
}

