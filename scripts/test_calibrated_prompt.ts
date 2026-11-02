import { callModelRouter } from "../src/lib/ai/model-router";
import { SDR_LEAD_SYSTEM_PROMPT } from "../src/lib/ai/sdr/sdr-prompts";

async function testPromptGeneration() {
  console.log("=== TESTANDO CALIBRAÇÃO DO AGENTE SDR HUMANO (OPENROUTER FREE) ===\n");

  const historicoMensagens = [
    {
      role: "assistant" as const,
      content:
        "Oi Carlos! Tudo bem? Vi seu interesse no apê do Embaré (#6430). 😊\nVocê busca pra morar com a família ou pensa mais em investimento?",
    },
    {
      role: "user" as const,
      content:
        "Olá! É pra morar sim, comigo, esposa e nosso filho pequeno. Mas quanto tá saindo condomínio e IPTU desse imóvel? Prédio no Embaré costuma ter condomínio puxado.",
    },
  ];

  const userPrompt = `DADOS DO IMÓVEL DE INTERESSE:
Código: #6430
Bairro: Embaré
Tipologia: 2 dormitórios (1 suíte), 82m², 1 vaga
Valor: R$ 580.000
Condomínio: R$ 485 (com fundo de reserva, fachada reformada recentemente)
IPTU: R$ 165/mês

HISTÓRICO DA CONVERSA:
${historicoMensagens.map((m) => `${m.role === "assistant" ? "SDR Rhema" : "Cliente"}: ${m.content}`).join("\n")}

ÚLTIMA MENSAGEM DO CLIENTE:
"Olá! É pra morar sim, comigo, esposa e nosso filho pequeno. Mas quanto tá saindo condomínio e IPTU desse imóvel? Prédio no Embaré costuma ter condomínio puxado."

Gere a resposta humana em JSON estrito com 'replyParts' (2 balões curtos):
- Balão 1: Responda a dúvida de condomínio/IPTU de forma direta e tranquilizadora.
- Balão 2: Faça uma pergunta suave do próximo pilar (Pilar 3: prazo ou momento de mudança).`;

  console.log("Enviando requisição ao Modelo SDR...");
  const start = Date.now();
  const res = await callModelRouter({
    task: "LEAD_CHAT",
    messages: [
      { role: "system", content: SDR_LEAD_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    jsonMode: true,
  });
  const elapsed = Date.now() - start;

  console.log(`\n⏱️ Resposta gerada em ${elapsed}ms usando o modelo: ${res.modelUsed}`);
  console.log("------------------------------------------------------------");
  console.log("CONTEÚDO RETORNADO:");
  console.log(res.content);
  console.log("------------------------------------------------------------");

  try {
    const jsonClean = res.content.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonClean);
    console.log("\n✅ JSON VALIDADO COM SUCESSO:");
    console.log("• Temperatura:", parsed.temperatura);
    console.log("• Pauta/Fase:", parsed.proximoPasso);
    console.log("• Balões Gerados (replyParts):");
    parsed.replyParts?.forEach((part: string, idx: number) => {
      console.log(`  💬 [Balão ${idx + 1}] "${part}"`);
    });
  } catch (e) {
    console.warn("Retornou texto não-JSON:", res.content);
  }
  process.exit(0);
}

testPromptGeneration().catch(console.error);
