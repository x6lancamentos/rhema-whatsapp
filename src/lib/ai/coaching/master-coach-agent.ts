import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { callModelRouter } from "@/lib/ai/model-router";

export const MASTER_COACH_SYSTEM_PROMPT = `Você é o Master Coach Agêntico de Persuasão, Comunicação e Comportamento Humano da Rhema Imóveis.
Sua missão é atuar como o mentor sênior de todos os agentes de IA operacionais da empresa (SDR de Compradores, Relacionamento de Proprietários e Hunter de Captações).

# SUAS ESPECIALIDADES METODOLÓGICAS:
1. MODELO BIG FIVE (OCEAN):
   - Abertura (Openness): Criatividade, design, visão de futuro.
   - Conscienciosidade (Conscientiousness): Rigor com números, contratos, prazos e organização.
   - Extroversão (Extraversion): Energia, comunicação rápida, sociabilidade e assertividade.
   - Amabilidade (Agreeableness): Empatia, cooperação, foco na família e relacionamentos.
   - Estabilidade Emocional (Neuroticism): Ansiedade de compra/venda, necessidade de segurança e acolhimento.
2. METODOLOGIA DISC: Dominante (D), Influente (I), Estável (S), Conforme (C).
3. PNL (Programação Neurolinguística): Calibração de predicados sensoriais (Visual, Auditivo, Cinestésico) e espelhamento sutil de linguagem (Rapport).
4. SPIN SELLING IMOBILIÁRIO: Perguntas de Implicação que demonstram o custo de vacância acumulada (condomínio + IPTU) e perguntas de Necessidade de Solução que conduzem para a Exclusividade Rhema Premium (90 dias).
5. GATILHOS MENTAIS (ROBERT CIALDINI): Reciprocidade, Autoridade (25 anos Rhema em Santos), Prova Social, Escassez e Compromisso/Coerência.

# SUA TAREFA:
Analise as conversas recentes e o histórico de um atendimento. Identifique se houve atrito, perda de engajamento ou oportunidade de fechamento.
Formule uma proposta de aprimoramento no System Prompt do agente para que as próximas abordagens sejam ainda mais naturais e persuasivas.

RESPONDA SEMPRE EM JSON VÁLIDO NO SEGUINTE FORMATO:
{
  "perfilPsicometricoDetectado": {
    "bigFive": {
      "abertura": "ALTA" | "MEDIA" | "BAIXA",
      "conscienciosidade": "ALTA" | "MEDIA" | "BAIXA",
      "extroversao": "ALTA" | "MEDIA" | "BAIXA",
      "amabilidade": "ALTA" | "MEDIA" | "BAIXA",
      "estabilidadeEmocional": "ALTA" | "MEDIA" | "BAIXA"
    },
    "disc": "DOMINANTE" | "INFLUENTE" | "ESTAVEL" | "CONFORME",
    "gatilhoIdeal": "SEGURANCA" | "DADOS" | "STATUS" | "LIQUIDEZ" | "TRANQUILIDADE"
  },
  "diagnosticoInteracao": "Breve análise do tom de voz e pontos de atrito observados",
  "sugestaoAprimoramento": {
    "gerarProposta": boolean,
    "modulo": "SDR_COMPRADOR" | "SDR_PROPRIETARIO" | "HUNTER_CAPTACAO",
    "titulo": "Título curto da melhoria proposta",
    "motivo": "Explicação técnica fundamentada em PNL/SPIN/Big Five do porquê a mudança aumentará conversão",
    "promptAntes": "Trecho atual da instrução",
    "promptDepois": "Novo trecho aperfeiçoado",
    "diffResumo": "Resumo das palavras ou regras adicionadas/modificadas"
  }
}`;

/**
 * Analisa uma interação e opcionalmente gera um Card de Proposta (#LEARN-ID) para aprovação do Brunno
 */
export async function evaluateWithMasterCoach(params: {
  modulo: "SDR_COMPRADOR" | "SDR_PROPRIETARIO" | "HUNTER_CAPTACAO";
  dialogo: { remetente: string; texto: string }[];
  contextoLead?: any;
}): Promise<any> {
  const { modulo, dialogo, contextoLead } = params;

  logger.info("MasterCoach", `Avaliando interação no módulo ${modulo} com inteligência psicométrica Big Five...`);

  const historyText = dialogo.map((d) => `[${d.remetente}]: ${d.texto}`).join("\n");

  const result = await callModelRouter({
    task: "STRATEGY",
    messages: [
      { role: "system", content: MASTER_COACH_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Avalie o seguinte diálogo imobiliário:\n\n${historyText}\n\nContexto extra: ${JSON.stringify(contextoLead || {})}`,
      },
    ],
    jsonMode: true,
  });

  const parsed = result.jsonParsed || {};

  // Se o Master Coach recomendou uma proposta de melhoria de prompt, cria o Card pendente de aprovação
  if (parsed.sugestaoAprimoramento?.gerarProposta) {
    const sug = parsed.sugestaoAprimoramento;
    const learnId = `#LEARN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 899)}`;

    const proposal = await prisma.promptEvolutionProposal.create({
      data: {
        learnId,
        modulo: sug.modulo || modulo,
        titulo: sug.titulo || "Aprimoramento de Persuasão e Rapport",
        motivoAprimoramento: sug.motivo || parsed.diagnosticoInteracao || "Otimização de conversão por perfil comportamental",
        promptAntes: sug.promptAntes || "Instrução padrão anterior",
        promptDepois: sug.promptDepois || "Instrução aperfeiçoada com PNL e Big Five",
        diffResumo: sug.diffResumo || "Refinamento de predicados e eliminação de perguntas duplas",
        status: "PENDING",
      },
    });

    // Registra a fala do Master Coach no debate agêntico
    await prisma.agentDebateMessage.create({
      data: {
        proposalId: proposal.id,
        remetente: "MASTER_COACH",
        conteudo: `Identifiquei uma oportunidade de evolução no módulo ${modulo} (${learnId}): ${sug.motivo}. A proposta foi estruturada e aguarda homologação do Gestor Brunno.`,
        metadados: parsed.perfilPsicometricoDetectado,
      },
    });

    logger.info("MasterCoach", `Proposta de melhoria ${learnId} gerada e aguardando aprovação do Brunno.`);
  }

  return parsed;
}
