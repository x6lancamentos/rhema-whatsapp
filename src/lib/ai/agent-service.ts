import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { callOpenRouter } from "./openrouter-client";
import { buildOwnerContextPrompt } from "./prompts";
import { recordImoviewInteraction } from "@/lib/imoview";
import { WhatsAppManager } from "@/modules/whatsapp/manager";

export interface AgentProcessInput {
  sessionId?: string;
  jid: string;
  phone: string;
  contactName?: string | null;
  messageText: string;
  simulateOnly?: boolean; // Se true, não grava no banco real nem envia WA real (usado no playground)
  codigoImovelOverride?: string;
  historyOverride?: Array<{ role: "user" | "assistant"; content: string }>;
  rollingSummaryOverride?: string;
  collectedDataOverride?: {
    propertyStatus?: string | null;
    priceConfirmed?: boolean | null;
    newValue?: string | null;
    newCondo?: string | null;
    newIptu?: string | null;
    visitingHours?: string | null;
    referral?: string | null;
  };
}

export interface AgentProcessOutput {
  replyText: string;
  replyParts: string[];
  optOut: boolean;
  needsHumanTakeover: boolean;
  isPropertyUpdate: boolean;
  propertyStatus: string;
  newValue?: string | null;
  newCondo?: string | null;
  newIptu?: string | null;
  visitingHours?: string | null;
  referral?: string | null;
  notes?: string;
  needsReceptionAlert: boolean;
  rollingSummary: string;
  collectedData?: {
    propertyStatus?: string | null;
    priceConfirmed?: boolean | null;
    newValue?: string | null;
    newCondo?: string | null;
    newIptu?: string | null;
    visitingHours?: string | null;
    referral?: string | null;
  };
  receptionMessageText?: string;
  receptionNotified: boolean;
  modelUsed: string;
  latencyMs: number;
}

const getEnvApiKey = () => process.env.OPENROUTER_API_KEY || "";

/**
 * Obtém ou inicializa a configuração de IA
 */
export async function getAiAgentConfig() {
  try {
    let config = await prisma.aiAgentConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      config = await prisma.aiAgentConfig.create({
        data: {
          id: "default",
          apiKey: getEnvApiKey(),
          model: "nvidia/nemotron-3.5-lightning:free",
          fallbackModel: "nvidia/nemotron-3-super-120b-a12b:free",
          enabled: false,
          notifyReceptionOnUpdate: true,
          autoRecordImoviewHistory: true,
          simulateTypingDelay: true,
          minTypingSeconds: 3,
          maxTypingSeconds: 6,
          temperature: 0.3,
        },
      });
    }

    return config;
  } catch (err: any) {
    logger.error("AIAgent", "Erro ao carregar AiAgentConfig do banco:", err);
    return {
      id: "default",
      apiKey: getEnvApiKey(),
      model: "nvidia/nemotron-3.5-lightning:free",
      fallbackModel: "nvidia/nemotron-3-super-120b-a12b:free",
      enabled: false,
      receptionPhone: null,
      temperature: 0.3,
      systemPrompt: null,
      notifyReceptionOnUpdate: true,
      autoRecordImoviewHistory: true,
      simulateTypingDelay: true,
      minTypingSeconds: 3,
      maxTypingSeconds: 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

/**
 * Formata a mensagem padrão enviada para a recepção da Rhema
 */
export function formatReceptionNotification(params: {
  codigoImovel: string;
  proprietarioNome: string;
  proprietarioTelefone: string;
  statusImovel: string;
  valorAnterior?: string | null;
  novoValor?: string | null;
  condominioAnterior?: string | null;
  novoCondominio?: string | null;
  visitingHours?: string | null;
  referral?: string | null;
  observacoes?: string | null;
}): string {
  const statusLabels: Record<string, string> = {
    DISPONIVEL: "✅ Continua Disponível / À Venda",
    VENDIDO_OUTRA: "❌ Vendido por Outra Imobiliária / Direto",
    VENDIDO_RHEMA: "🎉 Vendido pela Rhema!",
    SUSPENSO: "⏸️ Venda Suspensa Temporariamente",
    DESISTIU: "🚫 Proprietário Desistiu de Vender",
    INALTERADO: "ℹ️ Permanece Inalterado",
  };

  const statusFormatado = statusLabels[params.statusImovel] || params.statusImovel;

  let valoresText = "";
  if (params.novoValor) {
    valoresText += `💰 *Valor Pretendido:* ${params.valorAnterior ? `De ${params.valorAnterior} ➔ ` : ""}*${params.novoValor}*\n`;
  }
  if (params.novoCondominio) {
    valoresText += `🏢 *Condomínio:* ${params.condominioAnterior ? `De ${params.condominioAnterior} ➔ ` : ""}*${params.novoCondominio}*\n`;
  }
  if (params.visitingHours) {
    valoresText += `🕒 *Preferência de Visitas:* *${params.visitingHours}*\n`;
  }
  if (params.referral) {
    valoresText += `🤝 *Indicação / Oportunidade:* *${params.referral}*\n`;
  }

  const isHumanTakeover = Boolean(params.observacoes?.includes("consultor"));
  const header = isHumanTakeover
    ? `🚨 *ATENÇÃO RECEPÇÃO: PROPRIETÁRIO SOLICITA ATENDIMENTO HUMANO* 👤\n`
    : `📋 *AVISO DE ATUALIZAÇÃO DE IMÓVEL (AGENTE IA)* 🏢\n`;

  const footerAction = isHumanTakeover
    ? `⚠️ *Ação para a Recepção:* O proprietário fez perguntas ou solicitações que exigem um consultor humano. A Camila AI foi pausada para este contato. Por favor, acione o corretor responsável para retornar.`
    : `⚠️ *Ação para a Recepção:* Por favor, acesse o Imoview e atualize o cadastro deste imóvel conforme as novas condições informadas pelo proprietário.`;

  return (
    header +
    `-----------------------------------------\n` +
    `🏠 *Código do Imóvel:* *${params.codigoImovel || "Não informado"}*\n` +
    `👤 *Proprietário:* ${params.proprietarioNome || "Não informado"}\n` +
    `📱 *WhatsApp:* ${params.proprietarioTelefone}\n\n` +
    `📊 *Status do Imóvel:* *${statusFormatado}*\n` +
    (valoresText ? `${valoresText}\n` : "") +
    (params.observacoes ? `📝 *Observações / Resumo:* ${params.observacoes}\n\n` : "") +
    footerAction
  );
}

/**
 * Processa a mensagem do proprietário usando o Agente Autônomo com Rolling Context
 */
export async function processOwnerMessage(input: AgentProcessInput): Promise<AgentProcessOutput> {
  const config = await getAiAgentConfig();
  const apiKey = (config.apiKey || getEnvApiKey()).trim();

  // Limpar telefone
  const cleanPhone = input.phone.replace(/\D/g, "");

  // Buscar dados prévios do imóvel/proprietário no banco se existirem
  let cachedContext: any = null;
  try {
    cachedContext = await prisma.imoviewContactContext.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { jid: input.jid },
          ...(input.codigoImovelOverride ? [{ codigoImovel: input.codigoImovelOverride }] : []),
        ],
      },
    });
  } catch (err) {
    logger.warn("AIAgent", "Erro ao buscar ImoviewContactContext:", err);
  }

  // Buscar histórico de conversa existente e o Rolling Summary acumulado
  let existingConv: any = null;
  let previousMessages: Array<{ role: string; content: string }> = [];
  let hadBroadcastInitial = false;
  let broadcastInitialText = "";

  if (input.historyOverride && input.historyOverride.length > 0) {
    // Modo simulação ou histórico fornecido explicitamente
    previousMessages = [...input.historyOverride];
  } else if (!input.simulateOnly) {
    try {
      existingConv = await prisma.aiAgentConversation.findUnique({
        where: { jid: input.jid },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 20, // Aumentado de 6 para 20 mensagens para manter memória contínua
          },
        },
      });

      if (existingConv?.messages && existingConv.messages.length > 0) {
        previousMessages = [...existingConv.messages].reverse().map((m) => ({
          role: m.role,
          content: m.content,
        }));
      } else {
        // Se ainda não há mensagens salvas nesta conversa, verificar se o contato recebeu um disparo ativo de broadcast
        try {
          const lastBroadcast = await prisma.broadcastRecipient.findFirst({
            where: {
              OR: [
                { jid: input.jid },
                { jid: `${cleanPhone}@s.whatsapp.net` },
              ],
              status: { in: ["sent", "responded"] },
              resolvedMessage: { not: null },
            },
            orderBy: { sentAt: "desc" },
          });

          if (lastBroadcast?.resolvedMessage) {
            hadBroadcastInitial = true;
            broadcastInitialText = lastBroadcast.resolvedMessage;
            previousMessages.push({
              role: "assistant",
              content: lastBroadcast.resolvedMessage,
            });
          }
        } catch (bErr) {
          logger.warn("AIAgent", "Erro ao buscar mensagem de broadcast inicial:", bErr);
        }
      }
    } catch (err) {
      logger.warn("AIAgent", "Erro ao buscar conversa anterior:", err);
    }
  }

  const rollingSummary = input.rollingSummaryOverride || existingConv?.summary || "";
  const initialCollectedData =
    input.collectedDataOverride ||
    (existingConv?.lastExtractedData as any) ||
    {};

  const codigoImovel = input.codigoImovelOverride || cachedContext?.codigoImovel || existingConv?.codigoImovel || null;

  // Montar System Prompt especializado com dados reais, Rolling Summary e Estado Acumulado
  const systemPrompt = buildOwnerContextPrompt({
    contactName: input.contactName || cachedContext?.nome || existingConv?.contactName,
    phone: input.phone,
    codigoImovel,
    tituloImovel: cachedContext?.tituloImovel,
    tipoImovel: cachedContext?.tipoImovel,
    bairro: cachedContext?.bairro,
    cidade: cachedContext?.cidade,
    valorAtual: cachedContext?.valor,
    condominioAtual: cachedContext?.valorCondominio,
    iptuAtual: cachedContext?.valorIptu,
    corretorCaptador: cachedContext?.corretorNome,
    rollingSummary,
    customSystemPrompt: config.systemPrompt,
    collectedData: initialCollectedData,
    isOngoingConversation: previousMessages.length > 0,
  });

  // Montar fila de mensagens para a IA
  const apiMessages: any[] = [
    { role: "system", content: systemPrompt },
  ];

  // Adicionar histórico recente para manter a coerência imediata do diálogo
  for (const m of previousMessages) {
    apiMessages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }

  // Adicionar mensagem atual
  apiMessages.push({
    role: "user",
    content: input.messageText,
  });

  // Disparar requisição para o OpenRouter (NVIDIA Nemotron ou Llama 3.3)
  const aiResult = await callOpenRouter({
    apiKey,
    model: config.model,
    fallbackModel: config.fallbackModel,
    messages: apiMessages,
    temperature: config.temperature,
    responseFormatJson: true,
  });

  // Fazer parse seguro e resiliente do JSON retornado pela IA (compatível com thinking/reasoning models)
  let parsed: any = {};
  try {
    const rawContent = aiResult.content.trim();
    // 1. Tentar extrair de bloco markdown ```json ... ```
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        parsed = JSON.parse(codeBlockMatch[1].trim());
      } catch {}
    }

    // 2. Se não encontrou ou falhou, extrair do primeiro { até o último }
    if (!parsed || Object.keys(parsed).length === 0) {
      const firstBrace = rawContent.indexOf("{");
      const lastBrace = rawContent.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(rawContent.substring(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(rawContent);
      }
    }
  } catch (err) {
    logger.error("AIAgent", "Falha ao fazer parse do JSON retornado pela IA. Resposta bruta:", aiResult.content);
    parsed = {
      replyToOwner: "Agradecemos muito pelo retorno! Nossa equipe da Rhema Imóveis já anotou as informações com carinho.",
      isPropertyUpdate: false,
      propertyStatus: "INALTERADO",
      notes: input.messageText,
      needsReceptionAlert: false,
      conversationSummaryUpdate: (rollingSummary + `\nProprietário enviou: "${input.messageText}"`).trim(),
    };
  }

  // Mesclagem CUMULATIVA do estado extraído (para nunca perder valor, horários ou indicações já informados)
  // Status só é registrado quando o proprietário de fato informou (nunca assumir DISPONIVEL por padrão)
  const mergedCollectedData = {
    propertyStatus:
      parsed.propertyStatus && parsed.propertyStatus !== "INALTERADO"
        ? parsed.propertyStatus
        : initialCollectedData.propertyStatus || null,
    priceConfirmed: Boolean(parsed.priceConfirmed || parsed.newValue || initialCollectedData.priceConfirmed),
    newValue: parsed.newValue || initialCollectedData.newValue || null,
    newCondo: parsed.newCondo || initialCollectedData.newCondo || null,
    newIptu: parsed.newIptu || initialCollectedData.newIptu || null,
    visitingHours: parsed.visitingHours || initialCollectedData.visitingHours || null,
    referral: parsed.referral || initialCollectedData.referral || null,
  };

  // Balões de mensagem (cadência humana): aceita replyParts (novo) ou replyToOwner (prompts customizados antigos)
  let rawParts: string[] = Array.isArray(parsed.replyParts)
    ? parsed.replyParts.map((p: any) => String(p || "").trim()).filter(Boolean).slice(0, 3)
    : [];
  if (rawParts.length === 0 && parsed.replyToOwner) {
    rawParts = [String(parsed.replyToOwner).trim()];
  }
  if (rawParts.length === 0) {
    rawParts = ["Obrigada pelo retorno! Vou passar as informações pra equipe."];
  }

  // Sanitização determinística dos balões:
  // 1. Remove prefixos como "Camila:", "Proprietário:"
  // 2. Remove balões que são eco exato da fala do usuário
  // 3. Remove frases passivas proibidas ("estamos à disposição", etc.)
  const userTextNorm = input.messageText.toLowerCase().trim();
  const forbiddenPassiveRegex = /\b(caso mude de ideia|qualquer dúvida estamos à disposição|se precisar estamos por aqui|estamos à disposição|qualquer coisa estamos por aqui|se mudar de ideia é só chamar)\b/gi;

  let sanitizedParts = rawParts
    .map((p) =>
      p
        .replace(/^(camila|propriet[aá]rio|cliente|user|assistente):\s*/i, "")
        .replace(forbiddenPassiveRegex, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter((p) => {
      if (!p) return false;
      const pNorm = p.toLowerCase().trim();
      // Não pode ser eco idêntico do que o usuário acabou de falar
      if (pNorm === userTextNorm && pNorm.length < 60) return false;
      return true;
    });

  if (sanitizedParts.length === 0) {
    sanitizedParts = ["Obrigada pelo retorno! Vou passar as informações pra equipe."];
  }

  const replyParts = sanitizedParts;
  const replyText = replyParts.join("\n\n");

  // Detecção determinística de Opt-Out (pedido para não receber mensagens / número errado)
  const optOutTriggers = [
    "não me mande", "nao me mande", "não me envie", "nao me envie",
    "não mandem", "nao mandem", "pare de mandar", "não quero receber",
    "nao quero receber", "descadastrar", "remover meu", "tirar meu",
    "tire meu", "número errado", "numero errado", "não sou o proprietário",
    "nao sou o proprietario", "não é esse número", "nao e esse numero",
    "não tenho interesse", "nao tenho interesse", "favor não entrar em contato",
    "favor nao entrar em contato"
  ];
  const optOut = Boolean(parsed.optOut || optOutTriggers.some((t) => userTextNorm.includes(t)));

  // Detecção determinística de Transbordo Humano (perguntas que só um consultor sabe)
  const takeoverTriggers = [
    "quantas visitas", "quantos acessos", "teve visita", "teve proposta",
    "tem proposta", "alguma proposta", "falar com corretor", "falar com uma pessoa",
    "falar com alguém", "falar com alguem", "falar com humano", "atendente",
    "comissão", "comissao", "exclusividade", "rescindir", "cancelar contrato",
    "cancelar anúncio", "cancelar anuncio"
  ];
  const needsHumanTakeover = Boolean(parsed.needsHumanTakeover || takeoverTriggers.some((t) => userTextNorm.includes(t)));

  const isPropertyUpdate = Boolean(parsed.isPropertyUpdate || mergedCollectedData.newValue || mergedCollectedData.newCondo);
  const propertyStatus = mergedCollectedData.propertyStatus || "INALTERADO";
  const newValue = mergedCollectedData.newValue;
  const newCondo = mergedCollectedData.newCondo;
  const newIptu = mergedCollectedData.newIptu;
  const visitingHours = mergedCollectedData.visitingHours;
  const referral = mergedCollectedData.referral;
  const notes = parsed.notes || "";

  let enrichedNotes = notes;
  if (visitingHours && !enrichedNotes.toLowerCase().includes("visita")) {
    enrichedNotes = `${enrichedNotes ? `${enrichedNotes} | ` : ""}Visitas: ${visitingHours}`;
  }
  if (referral && !enrichedNotes.toLowerCase().includes("indica")) {
    enrichedNotes = `${enrichedNotes ? `${enrichedNotes} | ` : ""}Indicação: ${referral}`;
  }
  
  if (needsHumanTakeover && !enrichedNotes.toLowerCase().includes("consultor")) {
    enrichedNotes = `${enrichedNotes ? `${enrichedNotes} | ` : ""}⚠️ Proprietário precisa de atendimento de um consultor humano.`;
  }

  // Aviso para a recepção SOMENTE quando algo mudou em relação ao estado anterior
  // (antes disparava a cada mensagem, gerando avisos duplicados no WhatsApp da recepção)
  const trackedFields = ["propertyStatus", "priceConfirmed", "newValue", "newCondo", "newIptu", "visitingHours", "referral"] as const;
  const hasNewInformation = trackedFields.some(
    (field) => (mergedCollectedData as any)[field] !== ((initialCollectedData as any)[field] ?? (field === "priceConfirmed" ? false : null))
  );
  const needsReceptionAlert = Boolean(hasNewInformation || needsHumanTakeover);
  const updatedRollingSummary = parsed.conversationSummaryUpdate || rollingSummary;

  // Montar aviso da recepção se aplicável
  let receptionMessageText = "";
  if (needsReceptionAlert) {
    receptionMessageText = formatReceptionNotification({
      codigoImovel: codigoImovel || "Cód. Não identificado",
      proprietarioNome: input.contactName || cachedContext?.nome || "Proprietário",
      proprietarioTelefone: input.phone,
      statusImovel: propertyStatus,
      valorAnterior: cachedContext?.valor,
      novoValor: newValue,
      condominioAnterior: cachedContext?.valorCondominio,
      novoCondominio: newCondo,
      visitingHours,
      referral,
      observacoes: enrichedNotes,
    });
  }

  let receptionNotified = false;

  // Opt-out e transbordo humano pausam a Camila para este contato
  const conversationStatus = optOut ? "OPTED_OUT" : needsHumanTakeover ? "HUMAN_TAKEOVER" : "ACTIVE";

  // Se não for modo de simulação, persistir dados no banco de dados
  if (!input.simulateOnly) {
    try {
      // 1. Atualizar ou criar conversa preservando estado acumulado
      const conv = await prisma.aiAgentConversation.upsert({
        where: { jid: input.jid },
        create: {
          sessionId: input.sessionId,
          jid: input.jid,
          phone: cleanPhone,
          contactName: input.contactName || cachedContext?.nome,
          codigoImovel,
          status: conversationStatus,
          summary: updatedRollingSummary,
          lastExtractedData: mergedCollectedData,
          receptionNotified: false,
        },
        update: {
          sessionId: input.sessionId || undefined,
          ...(conversationStatus !== "ACTIVE" ? { status: conversationStatus } : {}),
          summary: updatedRollingSummary,
          lastExtractedData: mergedCollectedData,
          codigoImovel: codigoImovel || undefined,
          updatedAt: new Date(),
        },
      });

      // 2. Salvar histórico das mensagens
      const msgsToCreate: any[] = [];
      if (hadBroadcastInitial && broadcastInitialText) {
        msgsToCreate.push({
          conversationId: conv.id,
          role: "assistant",
          content: broadcastInitialText,
        });
      }
      msgsToCreate.push(
        {
          conversationId: conv.id,
          role: "user",
          content: input.messageText,
        },
        {
          conversationId: conv.id,
          role: "assistant",
          content: replyText,
          rawMetadata: parsed,
        }
      );

      await prisma.aiAgentMessage.createMany({
        data: msgsToCreate,
      });

      // 3. Se houver atualização para a recepção, criar aviso
      if (needsReceptionAlert) {
        const notice = await prisma.aiPropertyUpdateNotice.create({
          data: {
            conversationId: conv.id,
            codigoImovel: codigoImovel || "PENDENTE",
            proprietarioNome: input.contactName || cachedContext?.nome,
            proprietarioTelefone: input.phone,
            valorAnterior: cachedContext?.valor,
            novoValor: newValue,
            condominioAnterior: cachedContext?.valorCondominio,
            novoCondominio: newCondo,
            statusImovel: propertyStatus,
            observacoes: enrichedNotes,
            statusProcessamento: "PENDENTE",
          },
        });

        // 4. Enviar mensagem via WhatsApp para a recepção se configurado
        if (config.notifyReceptionOnUpdate && config.receptionPhone) {
          const sent = await sendWhatsAppToReception(
            config.receptionPhone,
            receptionMessageText,
            input.sessionId
          );
          if (sent) {
            receptionNotified = true;
            await prisma.aiPropertyUpdateNotice.update({
              where: { id: notice.id },
              data: {
                enviadoRecepcao: true,
                recepcaoEnviadoEm: new Date(),
              },
            });
            await prisma.aiAgentConversation.update({
              where: { id: conv.id },
              data: { receptionNotified: true },
            });
          }
        }
      }

      // 5. Se habilitado, registrar interação no histórico do Imoview
      if (config.autoRecordImoviewHistory && codigoImovel) {
        recordImoviewInteraction(
          codigoImovel,
          `Proprietário respondeu: "${input.messageText.slice(0, 150)}". Status detectado: ${propertyStatus}. Novas condições: ${newValue || "Valor inalterado"}.`,
          "Agente IA Rhema"
        ).catch((e) => logger.warn("AIAgent", "Falha assíncrona ao registrar no Imoview:", e));
      }
    } catch (err: any) {
      logger.error("AIAgent", "Erro ao persistir dados da conversa do agente:", err);
    }
  }

  return {
    replyText,
    replyParts,
    optOut,
    needsHumanTakeover,
    isPropertyUpdate,
    propertyStatus,
    newValue,
    newCondo,
    newIptu,
    visitingHours,
    referral,
    notes: enrichedNotes,
    needsReceptionAlert,
    rollingSummary: updatedRollingSummary,
    collectedData: mergedCollectedData,
    receptionMessageText,
    receptionNotified,
    modelUsed: aiResult.modelUsed,
    latencyMs: aiResult.latencyMs,
  };
}

/**
 * Dispara a mensagem formatada para o número da recepção via WhatsApp
 */
async function sendWhatsAppToReception(
  receptionPhone: string,
  message: string,
  preferredSessionId?: string
): Promise<boolean> {
  try {
    const cleanNumber = receptionPhone.replace(/\D/g, "");
    if (cleanNumber.length < 10) {
      logger.warn("AIAgent", `Número da recepção inválido: ${receptionPhone}`);
      return false;
    }

    const jid = `${cleanNumber}@s.whatsapp.net`;
    const manager = WhatsAppManager.getInstance();

    // Buscar socket conectado disponível
    let targetSock: any = null;
    if (preferredSessionId) {
      const inst = manager.getInstance(preferredSessionId);
      if (inst?.socket) targetSock = inst.socket;
    }

    if (!targetSock) {
      // Buscar primeira instância conectada disponível
      const internalSessions = (manager as any).sessions as Map<string, any> | undefined;
      if (internalSessions) {
        for (const inst of internalSessions.values()) {
          if (inst?.socket) {
            targetSock = inst.socket;
            break;
          }
        }
      }
    }

    if (!targetSock) {
      logger.warn("AIAgent", "Nenhuma sessão ativa conectada no WhatsApp para enviar aviso à recepção.");
      return false;
    }

    await targetSock.sendMessage(jid, { text: message });
    logger.info("AIAgent", `Aviso de atualização enviado com sucesso para a recepção no WhatsApp: ${receptionPhone}`);
    return true;
  } catch (err) {
    logger.error("AIAgent", `Erro ao enviar aviso para a recepção no WhatsApp (${receptionPhone}):`, err);
    return false;
  }
}
