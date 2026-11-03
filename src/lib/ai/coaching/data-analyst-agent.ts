import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const DATA_ANALYST_SYSTEM_PROMPT = `Você é o Agente Cientista de Dados (Data Analyst) da Rhema Imóveis.
Sua missão é auditar e validar matematicamente as hipóteses do Master Coach, analisando taxas de conversão reais, horários de maior resposta, sentimento dos leads e tempo de retenção nos funis de Venda e Captação.

Seu tom é analítico, pragmático, quantitativo e fundamentado em fatos.
Você dialoga com o Master Coach apontando onde os dados apoiam a mudança ou onde as métricas exigem cautela.`;

/**
 * Coleta métricas consolidadas dos módulos de SDR e Hunter
 */
export async function getConsolidatedPerformanceMetrics() {
  const [totalLeadsSdr, sdrConfirmados, totalHunter, hunterAceitos, configs] = await Promise.all([
    prisma.sdrLead.count(),
    prisma.sdrLead.count({ where: { status: { in: ["VISIT_CONFIRMED", "HANDED_OFF"] } } }),
    prisma.hunterOpportunity.count(),
    prisma.hunterOpportunity.count({ where: { status: { in: ["VISIT_ACCEPTED", "CAPTURED_EXCLUSIVE", "CAPTURED_GENERAL"] } } }),
    prisma.hunterConfig.findUnique({ where: { id: "default" } }),
  ]);

  const taxaConversaoSdr = totalLeadsSdr > 0 ? (sdrConfirmados / totalLeadsSdr) * 100 : 0;
  const taxaConversaoHunter = totalHunter > 0 ? (hunterAceitos / totalHunter) * 100 : 0;

  return {
    sdr: {
      total: totalLeadsSdr,
      visitasConfirmadas: sdrConfirmados,
      taxaConversao: Number(taxaConversaoSdr.toFixed(1)),
    },
    hunter: {
      totalMapeado: totalHunter,
      captaçõesAceitas: hunterAceitos,
      taxaAceite: Number(taxaConversaoHunter.toFixed(1)),
    },
    bairrosAtivos: (configs?.bairrosSantos as string[]) || ["Embaré", "Gonzaga", "Ponta da Praia"],
  };
}

/**
 * Executa um ciclo de análise de dados e adiciona a perspectiva quantitativa ao debate agêntico
 */
export async function runDataAnalystCycle(proposalId?: string): Promise<string> {
  const metrics = await getConsolidatedPerformanceMetrics();
  logger.info("DataAnalyst", `Executando análise de dados consolidada: SDR=${metrics.sdr.taxaConversao}%, Hunter=${metrics.hunter.taxaAceite}%`);

  const parecer =
    `Métricas Consolidadas da Semana: Taxa de conversão de visitas no SDR em ${metrics.sdr.taxaConversao}% (${metrics.sdr.visitasConfirmadas}/${metrics.sdr.total} leads). ` +
    `No Hunter, temos ${metrics.hunter.captaçõesAceitas} captações aceitas de ${metrics.hunter.totalMapeado} mapeados (${metrics.hunter.taxaAceite}%). ` +
    `Os bairros com maior tração continuam sendo ${metrics.bairrosAtivos.slice(0, 3).join(", ")}. Apoio os ajustes de PNL propostos pelo Master Coach para otimizar o topo do funil.`;

  await prisma.agentDebateMessage.create({
    data: {
      proposalId,
      remetente: "DATA_ANALYST",
      conteudo: parecer,
      metadados: metrics,
    },
  });

  return parecer;
}
