import { callModelRouter } from "../src/lib/ai/model-router";
import { SDR_LEAD_SYSTEM_PROMPT } from "../src/lib/ai/sdr/sdr-prompts";

async function testSecondTurn() {
  console.log("=== TESTANDO TURNO 2: CRÉDITO / FGTS / AGENDAMENTO DE VISITA ===\n");

  const historicoMensagens = [
    { role: "assistant", content: "Oi Carlos! Tudo bem? Vi seu interesse no apê do Embaré (#6430). 😊\nVocê busca pra morar com a família ou pensa mais em investimento?" },
    { role: "user", content: "Olá! É pra morar sim, comigo, esposa e nosso filho pequeno. Mas quanto tá saindo condomínio e IPTU desse imóvel? Prédio no Embaré costuma ter condomínio puxado." },
    { role: "assistant", content: "O condomínio desse apê é de R$ 485 e já inclui fundo de reserva e fachada reformada recentemente. O IPTU sai por R$ 165/mês. Tranquilo pra sua rotina!\n\nMudança nos próximos 30-60 dias ou ainda está pesquisando para o futuro?" },
    { role: "user", content: "Queremos mudar até o começo do ano. Tenho FGTS e precisaria financiar o resto pelo banco. Vocês dão esse suporte de financiamento bancário?" }
  ];

  const userPrompt = `DADOS DO IMÓVEL DE INTERESSE:
Código: #6430
Bairro: Embaré
Tipologia: 2 dormitórios (1 suíte), 82m², 1 vaga
Valor: R$ 580.000
Condomínio: R$ 485 | IPTU: R$ 165/mês

HISTÓRICO DA CONVERSA:
${historicoMensagens.map((m) => `${m.role === "assistant" ? "SDR Rhema" : "Cliente"}: ${m.content}`).join("\n")}

ÚLTIMA MENSAGEM DO CLIENTE:
"Queremos mudar até o começo do ano. Tenho FGTS e precisaria financiar o resto pelo banco. Vocês dão esse suporte de financiamento bancário?"

Gere a resposta humana em JSON estrito com 'replyParts' (2 balões curtos):
- Balão 1: Tranquilize sobre suporte de financiamento e FGTS sem custo pela mesa de crédito Rhema.
- Balão 2: Proponha visita presencial com dupla escolha de dia/horário (ex: sábado 10:30 ou 15h).`;

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
  console.log("• Temperatura:", parsed.temperatura);
  console.log("• Próximo Passo:", parsed.proximoPasso);
  process.exit(0);
}

testSecondTurn().catch(console.error);

