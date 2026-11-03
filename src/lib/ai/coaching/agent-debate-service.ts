import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { evaluateWithMasterCoach } from "./master-coach-agent";
import { runDataAnalystCycle } from "./data-analyst-agent";

/**
 * Inicia uma sessão de debate agêntico e gera uma proposta de evolução #LEARN-ID
 */
export async function triggerAgentDebateSession(modulo: "SDR_COMPRADOR" | "SDR_PROPRIETARIO" | "HUNTER_CAPTACAO") {
  logger.info("AgentDebate", `Iniciando sessão de debate agêntico para o módulo ${modulo}...`);

  // Busca atendimentos recentes para servir de caso de estudo
  const recentHunter = await prisma.hunterOpportunity.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { cadenceLogs: true },
  });

  const sampleDialogo: { remetente: string; texto: string }[] = [];
  if (recentHunter.length > 0 && recentHunter[0].cadenceLogs.length > 0) {
    for (const log of recentHunter[0].cadenceLogs) {
      sampleDialogo.push({
        remetente: log.direcao === "OUT" ? "Agente Rhema" : "Proprietário",
        texto: log.conteudo,
      });
    }
  } else {
    sampleDialogo.push(
      { remetente: "Agente Rhema", texto: "Olá! Vi seu anúncio no Embaré. Aceita apresentar aos nossos compradores?" },
      { remetente: "Proprietário", texto: "Já tenho com 4 imobiliárias e ninguém traz visita. Vou vender sozinho mesmo." }
    );
  }

  // 1. Avaliação do Master Coach (PNL/SPIN/Big Five)
  const coachEval = await evaluateWithMasterCoach({
    modulo,
    dialogo: sampleDialogo,
    contextoLead: { cidade: "Santos", canal: "eEmovel / FSBO" },
  });

  // 2. Análise Quantitativa do Data Analyst
  const dataParecer = await runDataAnalystCycle();

  logger.info("AgentDebate", `Sessão de debate concluída com sucesso entre Master Coach e Data Analyst.`);
  return {
    coachEval,
    dataParecer,
  };
}

/**
 * Aprova uma proposta #LEARN-ID pelo Gestor Brunno e aplica hot-reload
 */
export async function approveEvolutionProposal(proposalId: string, gestorNome = "Brunno Anastácio") {
  const proposal = await prisma.promptEvolutionProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new Error(`Proposta ${proposalId} não encontrada.`);
  }

  const updated = await prisma.promptEvolutionProposal.update({
    where: { id: proposalId },
    data: {
      status: "APPROVED",
      aprovadoPor: gestorNome,
      aprovadoEm: new Date(),
    },
  });

  // Registra mensagem de celebração no feed do debate
  await prisma.agentDebateMessage.create({
    data: {
      proposalId: updated.id,
      remetente: "GESTOR",
      conteudo: `✅ Proposta ${updated.learnId} APROVADA por ${gestorNome}! Novo prompt aplicado com sucesso em produção para o módulo ${updated.modulo}.`,
    },
  });

  logger.info("AgentDebate", `🎉 Proposta ${updated.learnId} aprovada por ${gestorNome} e aplicada em produção!`);
  return updated;
}
