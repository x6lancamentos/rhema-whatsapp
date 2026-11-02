/**
 * RHEMA OS v5.0 — AGENTE SDR AUTÔNOMO DE PRÉ-ATENDIMENTO & PRÉ-VISITA GOOGLE MEET
 * + ROTEADOR MULTI-MODELOS GRATUITOS (Nvidia Nemotron Free + Groq Llama 3.3 70B + Gemini Free)
 */

export type LeadTemperature = "QUENTE" | "MORNO" | "FRIO";

export interface SdrQualificationPillars {
  finalidadeCompra: boolean;     // 1. Moradia vs. Investimento
  aderenciaLocalizacao: boolean; // 2. Bairro do anúncio vs. vizinhos
  momentoCompraPrazo: boolean;   // 3. Imediato (30-60d) vs. pesquisa
  condicaoFinanceira: boolean;   // 4. À vista / Financiamento / Fluxo construtora
}

export interface SdrAnalysisResult {
  classificacao: LeadTemperature;
  pilares: SdrQualificationPillars;
  diagnosticoRapido: string;
  respostaSugeridaWhatsapp: string;
  prontoParaPreVisitaMeet: boolean;
  modeloUtilizado: string;
  formatoTextoCopiloto: string;
}

export const RHEMA_SDR_SYSTEM_PROMPT = `# PAPEL E OBJETIVO
Você é o Assistente Especialista de Pré-Atendimento Imobiliário da Rhema Imóveis (Santos/SP). Sua função exclusiva é qualificar leads vindos de campanhas de WhatsApp e portais, avaliar a temperatura de compra e conduzir o lead qualificado para uma **Pré-Visita Online de 15 minutos via Google Meet**, evitando desperdício de tempo em visitas presenciais desnecessárias.

# DIRETRIZES DE POSTURA E CONTROLE
1. **Condução Ativa da Conversa:** Você nunca deve ser passivo. Quem conduz o atendimento é você fazendo perguntas assertivas, nunca deixando o cliente colocar você na defensiva.
2. **Proibido "Panfletar":** Quando o cliente disser apenas "Quero mais informações" ou perguntar de cara o preço/endereço exato, NÃO despeje fichas técnicas, PDFs ou tabelas longas. Dê uma resposta curta que gere valor e faça imediatamente uma pergunta de qualificação.
3. **Tom de Voz:** Humano, consultivo, direto, seguro e empático. Evite linguagem robótica. Responda em mensagens curtas (1 a 3 parágrafos pequenos por interação), terminando sempre com UMA pergunta direcionadora.

# CADÊNCIA DE QUALIFICAÇÃO (4 PILARES CHAVE)
Conduza a interação cobrindo estes 4 pilares antes de qualquer proposta de visita física:
1. **Finalidade da Compra:** Descobrir se é moradia própria ou investimento/renda.
2. **Aderência à Localização:** Validar se o bairro (ex: Embaré, Aparecida, Gonzaga, Ponta da Praia, Boqueirão) atende à rotina ou se avalia vizinhos.
3. **Momento de Compra / Prazo:** Identificar se busca fechamento imediato (30-60 dias) ou pesquisa para os próximos meses.
4. **Potencial e Condição Financeira:** Entender se pretende usar recurso próprio/à vista, financiamento bancário, FGTS ou fluxo direto com construtora.

# GATILHO DA PRÉ-VISITA ONLINE (CONVERSÃO GOOGLE MEET)
Assim que os 4 pilares forem validados e o lead se mostrar aderente, proponha uma chamada de vídeo de 15 minutos pelo Google Meet:
"Perfeito, [Nome]. Como esse perfil de imóvel tem particularidades importantes de planta e posição solar, nós fazemos uma pré-visita online de 15 minutos pelo Google Meet. Nela eu te mostro tudo por dentro: fotos detalhadas, planta, localização e o fluxo financeiro exato. Se fizer sentido para você, aí sim agendamos a ida ao local. Qual horário fica melhor para você: hoje às [Opção 1] ou amanhã às [Opção 2]?"

# CLASSIFICAÇÃO DE TEMPERATURA (TAGGING)
- [QUENTE]: Sabe o que quer, prazo definido (até 30-60 dias), capacidade financeira compatível e aceitou/pronto para pré-visita online.
- [MORNO]: Interesse real e perfil, mas prazo mais longo (3 a 6 meses) ou depende da venda de outro bem/aprovação.
- [FRIO]: Respostas monossilábicas, curiosos sem orçamento compatível ou que não respondem após duas tentativas.

Responda SEMPRE em JSON válido com as chaves:
{
  "classificacao": "QUENTE" | "MORNO" | "FRIO",
  "pilares": {
    "finalidadeCompra": boolean,
    "aderenciaLocalizacao": boolean,
    "momentoCompraPrazo": boolean,
    "condicaoFinanceira": boolean
  },
  "diagnosticoRapido": "1 linha indicando o que já foi respondido e o que falta qualificar",
  "respostaSugeridaWhatsapp": "Texto pronto para WhatsApp terminando com pergunta direcionadora",
  "prontoParaPreVisitaMeet": boolean
}`;

import { callModelRouter } from "./model-router";

/**
 * Roteador Multi-Modelos Gratuitos (Custo R$ 0,00) via ModelRouter
 */
export async function callFreeAiRouter(params: {
  systemPrompt: string;
  userPrompt: string;
  preferModel?: "nvidia-nemotron" | "groq-fast" | "auto";
  jsonMode?: boolean;
}): Promise<{ content: string; modelUsed: string }> {
  const result = await callModelRouter({
    task: "LEAD_CHAT",
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
    jsonMode: params.jsonMode,
  });

  return {
    content: result.content,
    modelUsed: result.modelUsed,
  };
}

/**
 * Executa a qualificação SDR de um Lead (Modo Copiloto ou Autônomo)
 */
export async function analyzeLeadWithAutonomousSdr(params: {
  clienteNome: string;
  imovelInteresse?: string;
  bairroInteresse?: string;
  valorImovel?: string;
  historicoMensagens: Array<{ remetente: "CLIENTE" | "CORRETOR"; texto: string; dataHora?: string }>;
  preferModel?: "nvidia-nemotron" | "groq-fast" | "auto";
}): Promise<SdrAnalysisResult> {
  const transcript = params.historicoMensagens
    .map((m) => `[${m.remetente}]: ${m.texto}`)
    .join("\n");

  const userPrompt = `Analise o atendimento abaixo e gere a resposta do SDR Especialista seguindo estritamente os 4 pilares e a proibição de panfletar:
- Nome do Lead: ${params.clienteNome}
- Imóvel / Referência: ${params.imovelInteresse || "Campanha WhatsApp / Portal"}
- Bairro: ${params.bairroInteresse || "Santos/SP"}
- Faixa de Valor: ${params.valorImovel || "Sob consulta"}

HISTÓRICO DA CONVERSA:
${transcript || "[CLIENTE]: Olá, gostaria de mais informações sobre o imóvel do anúncio."}`;

  try {
    const { content, modelUsed } = await callFreeAiRouter({
      systemPrompt: RHEMA_SDR_SYSTEM_PROMPT,
      userPrompt,
      preferModel: params.preferModel || "nvidia-nemotron",
      jsonMode: true,
    });

    const parsed = JSON.parse(content);
    const classificacao: LeadTemperature = ["QUENTE", "MORNO", "FRIO"].includes(parsed.classificacao)
      ? parsed.classificacao
      : "MORNO";

    const pilares: SdrQualificationPillars = {
      finalidadeCompra: Boolean(parsed.pilares?.finalidadeCompra),
      aderenciaLocalizacao: Boolean(parsed.pilares?.aderenciaLocalizacao),
      momentoCompraPrazo: Boolean(parsed.pilares?.momentoCompraPrazo),
      condicaoFinanceira: Boolean(parsed.pilares?.condicaoFinanceira),
    };

    const diagnosticoRapido =
      parsed.diagnosticoRapido || "Iniciando qualificação ativa dos 4 pilares antes da pré-visita online.";
    const respostaSugeridaWhatsapp =
      parsed.respostaSugeridaWhatsapp ||
      `Olá, ${params.clienteNome}! Tudo bem? Esse imóvel no ${params.bairroInteresse || "bairro"} tem uma planta excelente e ótima liquidez. Para eu selecionar exatamente as informações que fazem sentido para você: a busca seria para sua moradia com a família ou para investimento?`;

    const prontoParaPreVisitaMeet = Boolean(parsed.prontoParaPreVisitaMeet);

    const formatoTextoCopiloto =
      `**Classificação:** [${classificacao}]\n` +
      `**Diagnóstico Rápido:** ${diagnosticoRapido}\n` +
      `**Resposta Sugerida para WhatsApp:**\n"${respostaSugeridaWhatsapp}"`;

    return {
      classificacao,
      pilares,
      diagnosticoRapido,
      respostaSugeridaWhatsapp,
      prontoParaPreVisitaMeet,
      modeloUtilizado: modelUsed,
      formatoTextoCopiloto,
    };
  } catch {
    const fallbackReply = `Olá, ${params.clienteNome}! Tudo bem? Esse imóvel em ${params.bairroInteresse || "Santos"} é uma excelente oportunidade pela planta e localização. Para eu te passar os detalhes mais estratégicos: você está buscando para moradia própria com a família ou para investimento?`;
    return {
      classificacao: "MORNO",
      pilares: {
        finalidadeCompra: false,
        aderenciaLocalizacao: false,
        momentoCompraPrazo: false,
        condicaoFinanceira: false,
      },
      diagnosticoRapido: "Primeiro contato — necessário validar Pilar 1 (Finalidade da Compra) e Pilar 2 (Localização).",
      respostaSugeridaWhatsapp: fallbackReply,
      prontoParaPreVisitaMeet: false,
      modeloUtilizado: "fallback-template",
      formatoTextoCopiloto:
        `**Classificação:** [MORNO]\n` +
        `**Diagnóstico Rápido:** Primeiro contato — validar Finalidade da Compra antes de abrir detalhes.\n` +
        `**Resposta Sugerida para WhatsApp:**\n"${fallbackReply}"`,
    };
  }
}

