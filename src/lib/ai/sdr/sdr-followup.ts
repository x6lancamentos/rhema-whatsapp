import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendHumanBubblesWithTyping } from "./sdr-orchestrator";
import { formatPropertyDetailsUrl } from "./property-matcher";

/**
 * Verifica se o momento atual está dentro do horário comercial padrão de atendimento
 * Segunda a Sábado: 08:00 às 21:00
 * Domingo e Feriados: 09:00 às 18:00
 */
export function isWithinBusinessHours(date = new Date()): boolean {
  const brTime = new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hours = brTime.getHours();
  const minutes = brTime.getMinutes();
  const day = brTime.getDay(); // 0 = Domingo, 6 = Sábado
  const currentTime = hours + minutes / 60;

  if (day === 0) {
    return currentTime >= 9.0 && currentTime <= 18.0;
  }
  return currentTime >= 8.0 && currentTime <= 21.0;
}

/**
 * Calcula e agenda a próxima tentativa da régua anti-vácuo
 */
export async function scheduleNextFollowup(leadId: string, currentCount: number) {
  let nextDate: Date | null = null;
  const now = new Date();

  if (currentCount === 0) {
    // T1: +45 minutos
    nextDate = new Date(now.getTime() + 45 * 60 * 1000);
  } else if (currentCount === 1) {
    // T2: +24 horas
    nextDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (currentCount === 2) {
    // T3: +48 horas (totalizando 72h)
    nextDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  }

  await prisma.sdrLead.update({
    where: { id: leadId },
    data: {
      followupCount: currentCount,
      nextFollowupAt: nextDate,
      status: nextDate ? undefined : "NO_RESPONSE",
    },
  });
}

/**
 * 1. Processa a Régua Anti-Vácuo de Leads parados
 */
export async function runSdrFollowupTick(sock: any): Promise<number> {
  if (!sock) return 0;
  if (!isWithinBusinessHours()) return 0;

  const now = new Date();
  const leadsToFollowup = await prisma.sdrLead.findMany({
    where: {
      status: { in: ["CONTACTED", "QUALIFYING", "AWAITING_OWNER", "SCHEDULING"] },
      nextFollowupAt: { lte: now },
      followupCount: { lt: 3 },
    },
    include: {
      conversations: {
        where: { role: "LEAD", status: "ACTIVE" },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      },
    },
    take: 10,
  });

  let processed = 0;

  for (const lead of leadsToFollowup) {
    const conv = lead.conversations[0];
    if (!conv) continue;

    // Se a última mensagem recebida for do cliente (IN), ele já respondeu! Cancela follow-up.
    const lastMsg = conv.messages[0];
    if (lastMsg && lastMsg.direction === "IN") {
      await prisma.sdrLead.update({
        where: { id: lead.id },
        data: { nextFollowupAt: null },
      });
      continue;
    }

    const primeiroNome = lead.leadNome.split(" ")[0] || "tudo bem";
    const imovelCod = lead.codigoImovel || "6430";
    const urlImovel = formatPropertyDetailsUrl(imovelCod);
    const bairro = (lead.imovelSnapshot as any)?.bairro || "Santos";

    let bubbles: string[] = [];

    if (lead.followupCount === 0) {
      // Toque 1 (+45 min): Lembrança suave
      bubbles = [
        `Oi ${primeiroNome}! Conseguiu ver minha mensagem acima? 😊`,
        `Fica super em paz, só mandei pra não deixar passar sua dúvida sobre o apê!`,
      ];
    } else if (lead.followupCount === 1) {
      // Toque 2 (+24h): Destaque de localização + Link Oficial
      bubbles = [
        `Passando pra te contar: esse apê cód. #${imovelCod} no ${bairro} tem localização excelente e galeria completa aqui:`,
        `👉 ${urlImovel} Me conta o que achou da sala e da varanda quando der uma olhada!`,
      ];
    } else if (lead.followupCount === 2) {
      // Toque 3 (+72h): Dead-Deal CPR de encerramento amigável
      bubbles = [
        `Oi ${primeiroNome}, tudo bem?`,
        `Você já encontrou o imóvel que buscava ou ainda faz sentido mantermos essa busca no radar?`,
      ];
    }

    if (bubbles.length > 0) {
      try {
        await sendHumanBubblesWithTyping({
          sock,
          toJid: conv.jid,
          bubbles,
          conversationId: conv.id,
          modelUsed: `sdr-followup-t${lead.followupCount + 1}`,
        });

        await scheduleNextFollowup(lead.id, lead.followupCount + 1);
        processed++;
        logger.info("SdrFollowup", `Follow-up T${lead.followupCount + 1} disparado para ${lead.leadNome} (${conv.jid}).`);
      } catch (err) {
        logger.error("SdrFollowup", `Erro ao disparar follow-up para ${conv.jid}:`, err);
      }
    }
  }

  return processed;
}

/**
 * 2. Processa o Protocolo Anti-No-Show de Visitas
 */
export async function runSdrAntiNoShowTick(sock: any): Promise<number> {
  if (!sock) return 0;

  const now = new Date();
  const leadsComVisita = await prisma.sdrLead.findMany({
    where: {
      status: { in: ["VISIT_CONFIRMED", "HANDED_OFF"] },
      visitaDataHora: { gte: now },
    },
    include: {
      conversations: {
        where: { role: "LEAD", status: "ACTIVE" },
      },
    },
    take: 15,
  });

  let processed = 0;

  for (const lead of leadsComVisita) {
    if (!lead.visitaDataHora) continue;
    const conv = lead.conversations[0];
    if (!conv) continue;

    const diffHours = (lead.visitaDataHora.getTime() - now.getTime()) / (1000 * 60 * 60);
    const primeiroNome = lead.leadNome.split(" ")[0] || "tudo bem";
    const corretor = lead.corretorNome || "nosso consultor";
    const imovelCod = lead.codigoImovel || "o imóvel";

    const horaFormatada = lead.visitaDataHora.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

    const metadata: any = lead.pilares || {};

    // 1. Lembrete na véspera (entre 18h e 24h antes da visita)
    if (diffHours <= 24 && diffHours >= 16 && !metadata.lembreteVesperaEnviado) {
      const bubbles = [
        `Oi ${primeiroNome}! Tudo bem? Passando só pra alinhar: nossa visita amanhã às ${horaFormatada} no imóvel #${imovelCod} está confirmadíssima por aqui! 😊`,
        `O consultor ${corretor} já vai estar com as chaves te esperando pontualmente.`,
      ];

      try {
        await sendHumanBubblesWithTyping({
          sock,
          toJid: conv.jid,
          bubbles,
          conversationId: conv.id,
          modelUsed: "anti-no-show-vespera",
        });

        metadata.lembreteVesperaEnviado = true;
        await prisma.sdrLead.update({
          where: { id: lead.id },
          data: { pilares: metadata },
        });
        processed++;
        logger.info("AntiNoShow", `Lembrete de véspera enviado para ${lead.leadNome}.`);
      } catch (err) {
        logger.error("AntiNoShow", "Erro lembrete véspera:", err);
      }
    }

    // 2. Lembrete de 2 horas antes da visita
    if (diffHours <= 2.2 && diffHours >= 1.0 && !metadata.lembreteDuasHorasEnviado) {
      const bubbles = [
        `Oi ${primeiroNome}, tudo bem? O ${corretor} já está se organizando para o nosso encontro às ${horaFormatada} no apê #${imovelCod}.`,
        `Se precisar de ponto de referência ou tiver trânsito na chegada, pode avisar aqui! 🤝`,
      ];

      try {
        await sendHumanBubblesWithTyping({
          sock,
          toJid: conv.jid,
          bubbles,
          conversationId: conv.id,
          modelUsed: "anti-no-show-2h",
        });

        metadata.lembreteDuasHorasEnviado = true;
        await prisma.sdrLead.update({
          where: { id: lead.id },
          data: { pilares: metadata },
        });
        processed++;
        logger.info("AntiNoShow", `Lembrete de 2 horas enviado para ${lead.leadNome}.`);
      } catch (err) {
        logger.error("AntiNoShow", "Erro lembrete 2h:", err);
      }
    }
  }

  return processed;
}

/**
 * 3. Processa a Fila Matinal (Leads recebidos de madrugada)
 */
export async function runSdrMorningQueueTick(sock: any): Promise<number> {
  if (!sock) return 0;

  const brTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hours = brTime.getHours();
  const minutes = brTime.getMinutes();

  // Executa a partir das 07:45 até as 09:30
  const isMorningWindow = (hours === 7 && minutes >= 45) || (hours >= 8 && hours <= 9);
  if (!isMorningWindow) return 0;

  const queuedLeads = await prisma.sdrLead.findMany({
    where: {
      status: "QUEUED_FOR_MORNING",
    },
    include: {
      conversations: {
        where: { role: "LEAD", status: "ACTIVE" },
      },
    },
    take: 5,
  });

  let processed = 0;

  for (const lead of queuedLeads) {
    const conv = lead.conversations[0];
    if (!conv) continue;

    const primeiroNome = lead.leadNome.split(" ")[0] || "tudo bem";
    const imovelCod = lead.codigoImovel || "6430";
    const bairro = (lead.imovelSnapshot as any)?.bairro ? ` no ${(lead.imovelSnapshot as any).bairro}` : " em Santos";

    const aberturaBubbles = [
      `Bom dia, ${primeiroNome}! Tudo bem? Vi seu interesse no apê cód. #${imovelCod}${bairro}. 😊`,
      `Pra eu já separar os detalhes certos: você busca pra morar com a família ou pensa mais em investimento?`,
    ];

    try {
      await sendHumanBubblesWithTyping({
        sock,
        toJid: conv.jid,
        bubbles: aberturaBubbles,
        conversationId: conv.id,
        modelUsed: "morning-queue-opening",
      });

      await prisma.sdrLead.update({
        where: { id: lead.id },
        data: {
          status: "CONTACTED",
          nextFollowupAt: new Date(Date.now() + 45 * 60 * 1000), // Agenda T1
        },
      });

      processed++;
      logger.info("MorningQueue", `Lead matinal desrepresado com sucesso: ${lead.leadNome} (${conv.jid}).`);
    } catch (err) {
      logger.error("MorningQueue", `Erro ao desrepresar lead ${lead.leadNome}:`, err);
    }
  }

  return processed;
}

