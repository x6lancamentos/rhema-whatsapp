import { parseSdrIntakeMessage, normalizeBrPhone } from "../src/lib/ai/sdr/intake-parser";
import { assignBrokerForLead } from "../src/lib/ai/sdr/broker-assignment";
import { findMatchingAlternativeProperties } from "../src/lib/ai/sdr/property-matcher";
import { callModelRouter } from "../src/lib/ai/model-router";
import { SDR_LEAD_SYSTEM_PROMPT, SDR_OWNER_SYSTEM_PROMPT } from "../src/lib/ai/sdr/sdr-prompts";
import { prisma } from "../src/lib/prisma";

async function runSdrSimulation() {
  console.log("============================================================");
  console.log("🧪 INICIANDO TESTE COMPLETO DE SIMULAÇÃO DO AGENTE RHEMA SDR");
  console.log("============================================================\n");

  let allPassed = true;

  // -------------------------------------------------------------------------
  // TESTE 1: Parser de Mensagens do Grupo (Formatos da Camila)
  // -------------------------------------------------------------------------
  console.log("--- TESTE 1: Intake Parser (Mensagens da Camila no Grupo) ---");

  const msgEstruturada = 
`🏠 Imóvel: 6430
👤 Nome: Lucas Di Santo
📱 Tel: (13) 99740-1988
📍 Origem: ZAP
📝 Obs: perguntou se a vaga de garagem é demarcada`;

  const p1 = await parseSdrIntakeMessage(msgEstruturada);
  console.log("Formato Estruturado:", {
    success: p1.success,
    nome: p1.leadNome,
    telefone: p1.leadPhone,
    codigoImovel: p1.codigoImovel,
    origem: p1.origem
  });

  if (p1.success && p1.leadPhone.includes("13997401988") && p1.codigoImovel === "6430") {
    console.log("✅ [1.A] Parser estruturado: APROVADO");
  } else {
    console.error("❌ [1.A] Parser estruturado: FALHOU", p1);
    allPassed = false;
  }

  const msgTextoLivre = "Lead novo do VivaReal: Sandra Miranda no tel 13997273177 querendo ver o apto cód. 4432. Disse que tem FGTS.";
  const p2 = await parseSdrIntakeMessage(msgTextoLivre);
  console.log("Formato Texto Livre:", {
    success: p2.success,
    nome: p2.leadNome,
    telefone: p2.leadPhone,
    codigoImovel: p2.codigoImovel
  });

  if (p2.success && p2.leadPhone.includes("13997273177") && p2.codigoImovel === "4432") {
    console.log("✅ [1.B] Parser texto livre: APROVADO");
  } else {
    console.error("❌ [1.B] Parser texto livre: FALHOU", p2);
    allPassed = false;
  }

  const msgSemTelefone = "Camila: Lead interessado no imóvel 6430, nome Roberto";
  const p3 = await parseSdrIntakeMessage(msgSemTelefone);
  if (!p3.success && p3.missingPhone) {
    console.log("✅ [1.C] Detecção de telefone ausente: APROVADO (avisa Camila no grupo)");
  } else {
    console.error("❌ [1.C] Detecção de telefone ausente: FALHOU", p3);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TESTE 2: Fila de Rodízio e Presença (vendas_rhema.db)
  // -------------------------------------------------------------------------
  console.log("\n--- TESTE 2: Fila de Rodízio / Meritocracia (vendas_rhema.db) ---");
  const assignment = await assignBrokerForLead({
    leadNome: "Cliente Simulação",
    leadPhone: "5513999998888",
    imovelCodigo: "6430",
    temperatura: "QUENTE",
  });

  console.log("Corretor Selecionado:", {
    corretorNome: assignment.corretorNome,
    imoviewId: assignment.imoviewId,
    criterio: assignment.criterio,
  });

  if (assignment.corretorNome && assignment.imoviewId > 0) {
    console.log(`✅ [2] Distribuição por fila/meritocracia: APROVADO (${assignment.corretorNome} ID ${assignment.imoviewId})`);
  } else {
    console.error("❌ [2] Distribuição: FALHOU", assignment);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TESTE 3: Matchmaking de Imóveis Alternativos (Score >= 70, máx 3)
  // -------------------------------------------------------------------------
  console.log("\n--- TESTE 3: Matchmaking de Imóveis Alternativos da Rhema ---");
  const alternativas = await findMatchingAlternativeProperties({
    imovelOrigemCodigo: "6430",
    bairro: "Embaré",
    tipoImovel: "Apartamento",
    valorNumerico: 550000,
    quartosMin: 2,
    limite: 3,
  });

  console.log(`Opções encontradas: ${alternativas.length}`);
  alternativas.forEach((a, i) => {
    console.log(`  ${i + 1}. Cód ${a.codigo} - ${a.titulo} (${a.bairro}) | ${a.valorFormatado} | Score: ${a.score}`);
  });

  if (alternativas.length <= 3 && alternativas.every((a) => a.score >= 70 && a.codigo !== "6430")) {
    console.log("✅ [3] Matchmaker de alternativas (máx 3, score >= 70): APROVADO");
  } else {
    console.error("❌ [3] Matchmaker: FALHOU");
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TESTE 4: Diálogo Natural com o Lead (4 Pilares)
  // -------------------------------------------------------------------------
  console.log("\n--- TESTE 4: Conversação Natural do SDR (ModelRouter LEAD_CHAT) ---");
  const leadPrompt =
`Contexto: Lead Lucas Di Santo está interessado no imóvel #6430 no Embaré (R$ 520.000, 2 dorms).
Histórico:
[ASSISTENTE]: Olá, Lucas! Tudo bem? Esse imóvel no Embaré tem uma planta excelente. Para eu selecionar os melhores detalhes: seria para sua moradia com a família ou para investimento?
[CLIENTE]: Olá! É para morar com a minha esposa e nosso filho pequeno.`;

  const leadResult = await callModelRouter({
    task: "LEAD_CHAT",
    messages: [
      { role: "system", content: SDR_LEAD_SYSTEM_PROMPT },
      { role: "user", content: leadPrompt },
    ],
    jsonMode: true,
  });

  console.log("Resposta do Modelo:", {
    modelo: leadResult.modelUsed,
    latenciaMs: leadResult.latencyMs,
    parsed: leadResult.jsonParsed,
  });

  const finalidadeOk =
    leadResult.jsonParsed?.pilares?.finalidadeCompra === true ||
    leadResult.jsonParsed?.finalidadeCompra === true;

  if (
    finalidadeOk &&
    Array.isArray(leadResult.jsonParsed?.replyParts) &&
    leadResult.jsonParsed.replyParts.length > 0
  ) {
    console.log("✅ [4] Qualificação natural nos 4 pilares: APROVADO");
  } else {
    console.error("❌ [4] Qualificação: FALHOU", leadResult.jsonParsed);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TESTE 5: Fluxo Comercial quando Imóvel foi VENDIDO/DESISTIU (Regra 6)
  // -------------------------------------------------------------------------
  console.log("\n--- TESTE 5: Fluxo Comercial para Imóvel Vendido / Desistência (Regra 6) ---");
  const soldContext =
`ALERTA COMERCIAL CRÍTICO:
O imóvel cód. #6430 foi informado pelo proprietário como VENDIDO ontem.
O cliente acabou de enviar: "Gostaria de agendar para visitar esse imóvel do Embaré amanhã à tarde."
Instrução: Seja transparente com carinho, não frustre o lead e ofereça as alternativas:
- Cód. 5890: Apto 2 dorms no Embaré (R$ 540.000)
- Cód. 6120: Apto 2 dorms na Aparecida (R$ 495.000)`;

  const soldResult = await callModelRouter({
    task: "LEAD_CHAT",
    messages: [
      { role: "system", content: SDR_LEAD_SYSTEM_PROMPT },
      { role: "user", content: soldContext },
    ],
    jsonMode: true,
  });

  console.log("Resposta do Fluxo Comercial (Imóvel Vendido):", soldResult.jsonParsed?.replyParts);

  const replyJoined = (soldResult.jsonParsed?.replyParts || []).join(" ").toLowerCase();
  const mencionaAlternativasOuVenda =
    replyJoined.includes("proposta") ||
    replyJoined.includes("vendido") ||
    replyJoined.includes("fechamento") ||
    replyJoined.includes("reserva") ||
    replyJoined.includes("opç") ||
    replyJoined.includes("5890") ||
    replyJoined.includes("consultor") ||
    replyJoined.includes("especialista");

  if (mencionaAlternativasOuVenda) {
    console.log("✅ [5] Fluxo comercial de acolhimento e oferta de alternativas: APROVADO");
  } else {
    console.error("❌ [5] Fluxo comercial: FALHOU");
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TESTE 6: Aprendizado Contínuo e Insights de Melhoria (Regra 7)
  // -------------------------------------------------------------------------
  console.log("\n--- TESTE 6: Auto-Evolução e Aprendizado Contínuo (Regra 7) ---");
  const insight = await prisma.sdrLearningInsight.create({
    data: {
      tipo: "SUGESTAO_FLUXO",
      titulo: "Preferência por Varanda Gourmet em Imóveis de 2 Dormitórios no Embaré",
      diagnostico: "Leads do portal ZAP responderam 40% mais rápido quando a abertura destacou a sacada/varanda antes da pergunta sobre financiamento.",
      sugestaoAcao: "Priorizar gancho de varanda e vaga demarcada nos primeiros 2 turnos para bairros Embaré e Gonzaga.",
      notificadoGrupoSdr: false,
    },
  });

  console.log("Insight Registrado no Banco:", {
    id: insight.id,
    titulo: insight.titulo,
    tipo: insight.tipo,
  });

  if (insight.id) {
    console.log("✅ [6] Registro de melhoria contínua no banco: APROVADO");
  } else {
    console.error("❌ [6] Registro de melhoria contínua: FALHOU");
    allPassed = false;
  }

  console.log("\n============================================================");
  if (allPassed) {
    console.log("🎉 TODOS OS 6 TESTES DA SUÍTE RHEMA SDR FORAM APROVADOS COM SUCESSO!");
  } else {
    console.log("⚠️ ALGUNS TESTES APRESENTARAM FALHAS. VERIFIQUE OS LOGS ACIMA.");
  }
  console.log("============================================================");
}

runSdrSimulation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Erro fatal no teste:", err);
    process.exit(1);
  });
