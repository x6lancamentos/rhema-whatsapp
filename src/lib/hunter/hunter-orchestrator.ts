import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { callModelRouter } from "@/lib/ai/model-router";
import { HUNTER_SYSTEM_PROMPT } from "./hunter-prompts";
import { createFichaDraft } from "./ficha-bridge";
import { sendHumanBubblesWithTyping } from "../ai/sdr/sdr-orchestrator";
import { waManager } from "@/modules/whatsapp/manager";
import { wrapExternalUserMessage } from "@/lib/ai/prompt-sanitizer";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Número do Gerente Comercial (Brunno Anastácio)
const BRUNNO_WHATSAPP_JID = process.env.BRUNNO_WHATSAPP_JID || "556293856483@s.whatsapp.net";

// Mutex e controle de cadência anti-ban da Fila Hunter
let isJitterRunning = false;
let consecutiveSentCount = 0;
let batchCooldownUntil = 0;

export function getHunterJitterState() {
  return {
    isJitterRunning,
    consecutiveSentCount,
    batchCooldownUntil,
    inCooldown: Date.now() < batchCooldownUntil,
  };
}

export function resetHunterJitterStateForTesting() {
  isJitterRunning = false;
  consecutiveSentCount = 0;
  batchCooldownUntil = 0;
}

/**
 * 1. Processa a Fila Anti-Spam com Jitter Randômico (45s a 180s)
 */
/**
 * Obtém o socket Baileys ativo do WhatsAppManager
 */
export function getActiveWhatsAppSocket(): any {
  try {
    const sessions = (waManager as any)?.sessions;
    if (sessions && sessions instanceof Map) {
      for (const [id, inst] of sessions.entries()) {
        if (inst && inst.socket && inst.status === "CONNECTED") {
          return inst.socket;
        }
      }
    }
  } catch (e) {
    logger.warn("HunterOrchestrator", "Não foi possível obter socket do waManager:", e);
  }
  return null;
}

/**
 * Dispara abordagem manual direta em 1 oportunidade específica (Botão ▶ Abordar Agora)
 */
export async function approachSingleOpportunity(opportunityId: string): Promise<{ success: boolean; message: string; opportunity?: any }> {
  const opp = await prisma.hunterOpportunity.findUnique({
    where: { id: opportunityId },
  });

  if (!opp) {
    throw new Error("Oportunidade não encontrada.");
  }

  const valorFormatado = opp.valorPretendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let bubble1 = `Olá ${opp.proprietarioNome}, tudo bem? Aqui é da Rhema Imóveis em Santos.`;
  let bubble2 = `Vi seu anúncio do ${opp.tipoImovel.toLowerCase()} no ${opp.bairro}. Estamos com compradores em carteira buscando essa tipologia na sua rua. Podemos levar interessados com agendamento prévio?`;

  if (opp.tipoOportunidade === "REDUCAO_PRECO") {
    bubble2 = `Acompanhamos o mercado de Santos e vimos a recente atualização no valor do seu ${opp.tipoImovel.toLowerCase()} no ${opp.bairro} (${valorFormatado}). Temos clientes buscando nessa faixa exata. Aceitaria apresentar aos nossos compradores?`;
  } else if (opp.tipoOportunidade === "PARADO_LONGO_PRAZO") {
    bubble2 = `Vi que o seu ${opp.tipoImovel.toLowerCase()} no ${opp.bairro} está anunciado há algum tempo. Na Rhema trabalhamos com um programa de Exclusividade Premium de 90 dias com fotos profissionais e alta visibilidade. Gostaria de conhecer nossa proposta?`;
  }

  // Atualiza status para APPROACHING
  const updatedOpp = await prisma.hunterOpportunity.update({
    where: { id: opp.id },
    data: { status: "APPROACHING" },
  });

  // Tenta enviar via WhatsApp
  const sock = getActiveWhatsAppSocket();
  if (sock) {
    try {
      await sendHumanBubblesWithTyping({
        sock,
        toJid: opp.proprietarioJid,
        bubbles: [bubble1, bubble2],
        modelUsed: "hunter-direct-trigger",
      });
      logger.info("HunterOrchestrator", `Abordagem direta enviada para ${opp.proprietarioNome} (${opp.proprietarioJid}).`);
    } catch (e: any) {
      logger.warn("HunterOrchestrator", `Aviso no envio WhatsApp direto: ${e.message}`);
    }
  } else {
    logger.info("HunterOrchestrator", `Socket WhatsApp offline no momento; status atualizado para APPROACHING.`);
  }

  // Registra no log de cadência
  await prisma.hunterCadenceLog.create({
    data: {
      opportunityId: opp.id,
      direcao: "OUT",
      tipo: "INITIAL_PITCH",
      conteudo: `${bubble1}\n${bubble2}`,
      analiseCoach: { tipoAbordagem: opp.tipoOportunidade, manualTrigger: true },
    },
  });

  return {
    success: true,
    message: `Abordagem enviada para ${opp.proprietarioNome}!`,
    opportunity: updatedOpp,
  };
}

/**
 * Inicia a Fila Anti-Spam (Move DISCOVERED para QUEUED e ativa worker)
 */
export async function startHunterQueue(): Promise<{ success: boolean; count: number; message: string }> {
  const updated = await prisma.hunterOpportunity.updateMany({
    where: { status: "DISCOVERED" },
    data: { status: "QUEUED" },
  });

  await prisma.hunterConfig.upsert({
    where: { id: "default" },
    update: { ativo: true },
    create: {
      id: "default",
      ativo: true,
      bairrosSantos: ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida"],
      tiposImovel: ["Apartamento", "Casa", "Cobertura"],
    },
  });

  logger.info("HunterOrchestrator", `Fila de prospecção iniciada com ${updated.count} leads.`);

  return {
    success: true,
    count: updated.count,
    message: `Fila Anti-Spam iniciada! ${updated.count} oportunidades aguardando envio com Jitter (45s a 180s).`,
  };
}

/**
 * Pausa a Fila Anti-Spam
 */
export async function pauseHunterQueue(): Promise<{ success: boolean; message: string }> {
  await prisma.hunterConfig.upsert({
    where: { id: "default" },
    update: { ativo: false },
    create: {
      id: "default",
      ativo: false,
      bairrosSantos: ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida"],
      tiposImovel: ["Apartamento", "Casa", "Cobertura"],
    },
  });

  logger.info("HunterOrchestrator", "Fila de prospecção pausada com segurança.");

  return {
    success: true,
    message: "Fila Anti-Spam pausada com segurança.",
  };
}

export async function runHunterJitterTick(sock: any): Promise<number> {
  if (!sock) return 0;

  // 1. Mutex Anti-Concorrência: Garante apenas uma execução de jitter por vez
  if (isJitterRunning) {
    logger.debug("HunterOrchestrator", "Tick ignorado: execução de Jitter já em andamento (Mutex ativo).");
    return 0;
  }

  // 2. Cooldown de Lote: Pausa obrigatória de 15 minutos a cada 5 envios sucessivos
  if (Date.now() < batchCooldownUntil) {
    const remainingMin = Math.ceil((batchCooldownUntil - Date.now()) / (60 * 1000));
    logger.info("HunterOrchestrator", `Cooldown anti-ban ativo (5 envios consecutivos atingidos). Aguardando mais ${remainingMin}min.`);
    return 0;
  }

  // 3. Janela de Operação Comercial: Bloqueia prospecção fria fora de 09:30 às 17:30
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startCommercial = 9 * 60 + 30; // 09:30
  const endCommercial = 17 * 60 + 30;   // 17:30

  if (currentMinutes < startCommercial || currentMinutes >= endCommercial) {
    logger.debug("HunterOrchestrator", "Fora da janela comercial de prospecção permitida (09:30 às 17:30).");
    return 0;
  }

  isJitterRunning = true;
  try {
    const config = await prisma.hunterConfig.findUnique({ where: { id: "default" } });
    if (config && !config.ativo) return 0;

    // Busca uma oportunidade aguardando disparo
    const opp = await prisma.hunterOpportunity.findFirst({
      where: {
        status: { in: ["DISCOVERED", "QUEUED"] },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!opp) return 0;

    // Calcula intervalo randômico de jitter seguro
    const delayMin = config?.delayMinSeg || 45;
    const delayMax = config?.delayMaxSeg || 180;
    const jitterSec = Math.floor(delayMin + Math.random() * (delayMax - delayMin));

    logger.info(
      "HunterOrchestrator",
      `Aguardando Jitter Anti-Spam real bloqueante (${jitterSec}s) antes de disparar para ${opp.proprietarioNome} (${opp.bairro})...`
    );

    // 4. Jitter Real Bloqueante: Suspende a execução pelo tempo sorteado antes de prosseguir
    await sleep(jitterSec * 1000);

    const valorFormatado = opp.valorPretendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    let bubble1 = `Olá ${opp.proprietarioNome}, tudo bem? Aqui é da Rhema Imóveis em Santos.`;
    let bubble2 = `Vi seu anúncio do ${opp.tipoImovel.toLowerCase()} no ${opp.bairro}. Estamos com compradores em carteira buscando essa tipologia na sua rua. Podemos levar interessados com agendamento prévio?`;

    if (opp.tipoOportunidade === "REDUCAO_PRECO") {
      bubble2 = `Acompanhamos o mercado de Santos e vimos a recente atualização no valor do seu ${opp.tipoImovel.toLowerCase()} no ${opp.bairro} (${valorFormatado}). Temos clientes buscando nessa faixa exata. Aceitaria apresentar aos nossos compradores?`;
    } else if (opp.tipoOportunidade === "PARADO_LONGO_PRAZO") {
      bubble2 = `Vi que o seu ${opp.tipoImovel.toLowerCase()} no ${opp.bairro} está anunciado há algum tempo. Na Rhema trabalhamos com um programa de Exclusividade Premium de 90 dias com fotos profissionais e alta visibilidade. Gostaria de conhecer nossa proposta?`;
    }

    // Atualiza status para APPROACHING antes do envio
    await prisma.hunterOpportunity.update({
      where: { id: opp.id },
      data: { status: "APPROACHING" },
    });

    // Envia bolhas humanas com simulação de digitação
    await sendHumanBubblesWithTyping({
      sock,
      toJid: opp.proprietarioJid,
      bubbles: [bubble1, bubble2],
      modelUsed: "hunter-outbound-jitter",
    });

    // Registra no log de cadência
    await prisma.hunterCadenceLog.create({
      data: {
        opportunityId: opp.id,
        direcao: "OUT",
        tipo: "INITIAL_PITCH",
        conteudo: `${bubble1}\n${bubble2}`,
        analiseCoach: { tipoAbordagem: opp.tipoOportunidade, jitterSegundos: jitterSec },
      },
    });

    logger.info("HunterOrchestrator", `Abordagem enviada com sucesso para ${opp.proprietarioNome} (${opp.proprietarioJid}).`);

    // 5. Cooldown de Lote: Após 5 envios, ativa pausa de 15 minutos
    consecutiveSentCount++;
    if (consecutiveSentCount >= 5) {
      logger.info(
        "HunterOrchestrator",
        "Lote de 5 envios consecutivos atingido. Acionando cooldown de 15 minutos para proteção de ban do WhatsApp."
      );
      batchCooldownUntil = Date.now() + 15 * 60 * 1000;
      consecutiveSentCount = 0;
    }

    return 1;
  } finally {
    isJitterRunning = false;
  }
}

/**
 * 2. Processa respostas recebidas de proprietários abordados pelo Hunter
 */
export async function handleInboundHunterMessage(params: {
  sock: any;
  remoteJid: string;
  cleanPhone: string;
  text: string;
}): Promise<{ handled: boolean; replySent?: boolean }> {
  const { sock, remoteJid, cleanPhone, text } = params;

  // Busca se existe oportunidade ativa no Hunter para esse remetente
  const opp = await prisma.hunterOpportunity.findFirst({
    where: {
      OR: [{ proprietarioJid: remoteJid }, { proprietarioTelefone: { contains: cleanPhone.slice(-8) } }],
      status: { in: ["APPROACHING", "NEGOTIATING"] },
    },
    include: {
      cadenceLogs: {
        orderBy: { createdAt: "desc" },
        take: 6,
      },
    },
  });

  if (!opp) return { handled: false };

  logger.info("HunterOrchestrator", `Resposta de proprietário Hunter recebida de ${opp.proprietarioNome}: "${text}"`);

  // Registra a mensagem do proprietário
  await prisma.hunterCadenceLog.create({
    data: {
      opportunityId: opp.id,
      direcao: "IN",
      tipo: "OWNER_REPLY",
      conteudo: text,
    },
  });

  // Monta histórico para a IA
  const history = [...(opp.cadenceLogs || [])].reverse().map((m) => ({
    role: m.direcao === "OUT" ? ("assistant" as const) : ("user" as const),
    content: m.conteudo,
  }));

  // Sanitiza a mensagem do usuário contra Prompt Injection
  const sanitizedUserMessage = wrapExternalUserMessage(text);

  // Executa o Modelo Cognitivo do Hunter
  const result = await callModelRouter({
    task: "OWNER_CHAT",
    messages: [
      { role: "system", content: HUNTER_SYSTEM_PROMPT },
      ...history,
      { role: "user", content: sanitizedUserMessage },
    ],
    jsonMode: true,
  });

  const parsed = result.jsonParsed || {};
  const replyParts: string[] = Array.isArray(parsed.replyParts) && parsed.replyParts.length > 0
    ? parsed.replyParts
    : ["Perfeito! Muito obrigado pelo retorno.", "Vou alinhar com a nossa gerência e já te retorno com os detalhes."];

  const ownerIntent = parsed.ownerIntent || "NEGOTIATING";
  const psicometria = parsed.psicometria || null;
  const aceitouVisita = parsed.aceitouVisita === true || ownerIntent === "VISIT_ACCEPTED";

  // Envia resposta calibrada para o proprietário
  await sendHumanBubblesWithTyping({
    sock,
    toJid: remoteJid,
    bubbles: replyParts,
    modelUsed: result.modelUsed,
  });

  // Registra saída
  await prisma.hunterCadenceLog.create({
    data: {
      opportunityId: opp.id,
      direcao: "OUT",
      tipo: aceitouVisita ? "VISIT_ACCEPTED" : "OBJECTION_HANDLING",
      conteudo: replyParts.join("\n"),
      analiseCoach: parsed,
    },
  });

  // Atualiza estado e perfil psicométrico no banco
  await prisma.hunterOpportunity.update({
    where: { id: opp.id },
    data: {
      status: aceitouVisita ? "VISIT_ACCEPTED" : ownerIntent === "NOT_INTERESTED" ? "REJECTED" : "NEGOTIATING",
      perfilPsicometrico: psicometria,
    },
  });

  // =========================================================================
  // GATILHO CENTRAL: PROPRIETÁRIO ACEITOU VISITA -> DOSSIÊ ENVIADO AO BRUNNO
  // =========================================================================
  if (aceitouVisita) {
    logger.info("HunterOrchestrator", `🎉 CAPTAÇÃO ACEITA por ${opp.proprietarioNome}! Criando Pré-Ficha e notificando Gerente Brunno...`);

    // 1. Cria Pré-Ficha Digital
    const ficha = await createFichaDraft({
      proprietarioNome: opp.proprietarioNome,
      proprietarioTelefone: opp.proprietarioTelefone,
      bairro: opp.bairro,
      tipoImovel: opp.tipoImovel,
      valorVenda: opp.valorPretendido,
      condominio: opp.condominio || 0,
      iptu: opp.iptu || 0,
      quartos: opp.quartos || 0,
      enderecoAprox: opp.enderecoAprox || `Santos/SP - Bairro ${opp.bairro}`,
      captadorNome: "Brunno Anastácio (Gerência)",
    });

    await prisma.hunterOpportunity.update({
      where: { id: opp.id },
      data: {
        fichaDigitalId: ficha.fichaId,
        notificadoBrunnoEm: new Date(),
      },
    });

    // 2. Dispara Dossiê Executivo Direto no WhatsApp do Brunno (Gerente)
    const valorFormatado = opp.valorPretendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const discPerfil = psicometria?.disc || "Conforme";
    const gatilhoPerfil = psicometria?.gatilhoIdeal || "Segurança Jurídica";

    const dossieBrunno =
      `🚨 *[RHEMA HUNTER] NOVA CAPTAÇÃO ACEITA PELO PROPRIETÁRIO!*\n\n` +
      `🏠 *Imóvel:* ${opp.tipoImovel} no ${opp.bairro}\n` +
      `💰 *Valor:* ${valorFormatado} (Cond: R$ ${opp.condominio || 0} | IPTU: R$ ${opp.iptu || 0})\n` +
      `👤 *Proprietário:* ${opp.proprietarioNome}\n` +
      `📲 *Telefone:* ${opp.proprietarioTelefone}\n` +
      `📍 *Endereço/Ref:* ${opp.enderecoAprox || "Santos/SP"}\n` +
      `🧠 *Perfil Psicométrico:* ${discPerfil} (Gatilho: ${gatilhoPerfil})\n\n` +
      `📸 *Pré-Ficha Digital no Rhema Hub:*\n👉 ${ficha.urlApp}\n\n` +
      `🧭 *Ação da Gerência:* Defina qual corretor da equipe irá realizar as fotos oficiais e a formalização.`;

    try {
      await sleep(1500);
      await sock.sendMessage(BRUNNO_WHATSAPP_JID, { text: dossieBrunno });
      logger.info("HunterOrchestrator", `Dossiê de captação entregue no WhatsApp do Brunno (${BRUNNO_WHATSAPP_JID}).`);
    } catch (sendErr) {
      logger.warn("HunterOrchestrator", "Aviso ao enviar dossiê ao Brunno via WhatsApp:", sendErr);
    }
  }

  return { handled: true, replySent: true };
}
