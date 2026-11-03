import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { callModelRouter } from "@/lib/ai/model-router";
import { HUNTER_SYSTEM_PROMPT } from "./hunter-prompts";
import { createFichaDraft } from "./ficha-bridge";
import { sendHumanBubblesWithTyping } from "../ai/sdr/sdr-orchestrator";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Número do Gerente Comercial (Brunno Anastácio)
const BRUNNO_WHATSAPP_JID = process.env.BRUNNO_WHATSAPP_JID || "556293856483@s.whatsapp.net";

/**
 * 1. Processa a Fila Anti-Spam com Jitter Randômico (45s a 180s)
 */
export async function runHunterJitterTick(sock: any): Promise<number> {
  if (!sock) return 0;

  // Checa horário comercial seguro para prospecção fria (09:30 às 17:30)
  const now = new Date();
  const hours = now.getHours();
  if (hours < 9 || hours >= 18) {
    return 0;
  }

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
    `Preparando abordagem com Jitter Anti-Spam (${jitterSec}s) para ${opp.proprietarioNome} (${opp.bairro})...`
  );

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
  return 1;
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

  // Executa o Modelo Cognitivo do Hunter
  const result = await callModelRouter({
    task: "OWNER_CHAT",
    messages: [
      { role: "system", content: HUNTER_SYSTEM_PROMPT },
      ...history,
      { role: "user", content: text },
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
