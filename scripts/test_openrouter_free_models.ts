import { logger } from "../src/lib/logger";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

const MODELS_TO_TEST = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "thinkingmachines/inkling:free",
  "thinkingmachines/inkling-small:free",
];

async function testModels() {
  console.log("=== TESTANDO MODELOS GRATUITOS DO OPENROUTER ===");
  if (!OPENROUTER_KEY) {
    throw new Error("OPENROUTER_API_KEY não encontrada no .env");
  }

  for (const model of MODELS_TO_TEST) {
    const start = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://rhemaimoveis.com.br",
          "X-Title": "Rhema SDR Tester",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 150,
          messages: [
            { role: "system", content: "Você é um assistente SDR imobiliário. Responda em JSON com a chave 'status': 'ok'." },
            { role: "user", content: "Teste de conexão" },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latency = Date.now() - start;
      if (!res.ok) {
        const errText = await res.text();
        console.log(`❌ ${model} | HTTP ${res.status} (${latency}ms): ${errText.slice(0, 100)}`);
      } else {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        console.log(`✅ ${model} | Sucesso em ${latency}ms | Resposta: ${content.trim().slice(0, 80)}`);
      }
    } catch (err: any) {
      console.log(`❌ ${model} | Erro: ${err.message}`);
    }
  }
}

testModels().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

