import { callModelRouter } from "../src/lib/ai/model-router";
import { SDR_LEAD_SYSTEM_PROMPT } from "../src/lib/ai/sdr/sdr-prompts";

async function testThirdTurn() {
  console.log("=== TESTANDO TURNO 3: OBJEÇÃO DE PRESSÃO + CONFIRMAÇÃO ===\n");

  const historicoMensagens = [
    { role: "assistant", content: "Nossa mesa de crédito analisa e aprova direto com Caixa/Itaú/Santander, e podemos sim usar seu FGTS sem custo extra!\n\nO que acha de darmos um pulo lá pra você sentir o espaço ao vivo? Para você e sua esposa, fica melhor no sábado às 10:30 ou às 15:00?" },
    { role: "user", content: "Perfeito! Sábado às 10:30 fica bom pra nós. Só peço que não fique corretor insistente pressionando, meu tempo é bem corrido." }
  ];

  const userPrompt = `DADOS DO IMÓVEL DE INTERESSE:
Código: #6430 | Embaré | R$ 580.000

HISTÓRICO DA CONVERSA:
${historicoMensagens.map((m) => `${m.role === "assistant" ? "SDR Rhema" : "Cliente"}: ${m.content}`).join("\n")}

ÚLTIMA MENSAGEM DO CLIENTE:
"Perfeito! Sábado às 10:30 fica bom pra nós. Só peço que não fique corretor insistente pressionando, meu tempo é bem corrido."

Gere a resposta humana em JSON estrito com 'replyParts' (2 balões curtos):
- Balão 1: Tranquilize com total empatia afirmando que a postura Rhema é consultiva e zero pressão.
- Balão 2: Confirme o agendamento de sábado às 10:30 com chave na mão e finalize com simpatia.`;

  const res = await callModelRouter({
    task: "LEAD_CHAT",
    messages: [
      { role: "system", content: SDR_LEAD_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    jsonMode: true,
  });

  const jsonClean = res.content.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(jsonClean);
  console.log("• Balões Gerados (replyParts):");
  parsed.replyParts?.forEach((part: string, idx: number) => {
    console.log(`  💬 [Balão ${idx + 1}] "${part}"`);
  });
  console.log("• Intenção de Visita:", parsed.intencaoVisita);
  console.log("• Horário Sugerido:", parsed.horarioSugeridoPeloLead);
  console.log("• Temperatura:", parsed.temperatura);
  console.log("• Próximo Passo:", parsed.proximoPasso);
  process.exit(0);
}

testThirdTurn().catch(console.error);

