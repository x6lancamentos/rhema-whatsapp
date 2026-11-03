import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { collectEemovelOpportunities } from "./eemovel-service";

export interface ReverseHunterParams {
  leadId: string;
  leadNome: string;
  bairro?: string;
  tipoImovel?: string;
  valorMaximo?: number;
  quartosMin?: number;
}

export interface ReverseHunterResult {
  ativado: boolean;
  oportunidadesEncontradas: number;
  melhorOpcao?: {
    id: string;
    proprietarioNome: string;
    proprietarioTelefone: string;
    bairro: string;
    valor: number;
    mensagemSugerida: string[];
  };
}

/**
 * Executa a Captação Reversa (Buyer-Led Acquisition):
 * Quando o SDR não tem o imóvel em carteira, caça no eEmovel por proprietários similares
 * e prepara a abordagem com o comprador na mão!
 */
export async function executeReverseHunter(params: ReverseHunterParams): Promise<ReverseHunterResult> {
  const { leadId, leadNome, bairro = "Embaré", tipoImovel = "Apartamento", valorMaximo = 850000, quartosMin = 2 } = params;

  logger.info("ReverseHunter", `Acionando Captação Reversa para o lead ${leadNome}: ${tipoImovel} no ${bairro} até R$ ${valorMaximo}`);

  // 1. Primeiro verifica se já temos oportunidades descobertas no banco para aquele bairro e faixa
  let opportunities = await prisma.hunterOpportunity.findMany({
    where: {
      bairro: { contains: bairro, mode: "insensitive" },
      valorPretendido: { lte: valorMaximo * 1.1 }, // Até 10% acima do teto para negociação
      status: { in: ["DISCOVERED", "QUEUED"] },
    },
    take: 3,
  });

  // 2. Se não houver, dispara busca rápida no eEmovel para o bairro do lead
  if (opportunities.length === 0) {
    logger.info("ReverseHunter", `Sem oportunidades em cache no ${bairro}. Buscando novas no eEmovel...`);
    await collectEemovelOpportunities({
      bairros: [bairro],
      valorMin: valorMaximo * 0.7,
      valorMax: valorMaximo * 1.05,
      limite: 5,
    });

    opportunities = await prisma.hunterOpportunity.findMany({
      where: {
        bairro: { contains: bairro, mode: "insensitive" },
        valorPretendido: { lte: valorMaximo * 1.1 },
        status: { in: ["DISCOVERED", "QUEUED"] },
      },
      take: 3,
    });
  }

  if (opportunities.length === 0) {
    logger.info("ReverseHunter", `Nenhum particular compatível encontrado no momento para ${bairro}.`);
    return { ativado: true, oportunidadesEncontradas: 0 };
  }

  const best = opportunities[0];

  // 3. Atualiza oportunidade como REVERSE_DEMAND
  await prisma.hunterOpportunity.update({
    where: { id: best.id },
    data: {
      tipoOportunidade: "REVERSE_DEMAND",
      status: "QUEUED",
    },
  });

  const valorFormatado = best.valorPretendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const bubble1 = `Olá ${best.proprietarioNome}, tudo bem? Aqui é da Rhema Imóveis em Santos.`;
  const bubble2 = `Estou com um cliente qualificado em atendimento (${leadNome}) buscando exatamente ${tipoImovel.toLowerCase()} no ${best.bairro} nessa faixa de ${valorFormatado}.\n\nVi o anúncio do seu imóvel e o perfil é perfeito. Podemos levar ele aí para uma visita esta semana?`;

  logger.info("ReverseHunter", `Oportunidade #${best.id} vinculada ao comprador ${leadNome} com abordagem matadora.`);

  return {
    ativado: true,
    oportunidadesEncontradas: opportunities.length,
    melhorOpcao: {
      id: best.id,
      proprietarioNome: best.proprietarioNome,
      proprietarioTelefone: best.proprietarioTelefone,
      bairro: best.bairro,
      valor: best.valorPretendido,
      mensagemSugerida: [bubble1, bubble2],
    },
  };
}
