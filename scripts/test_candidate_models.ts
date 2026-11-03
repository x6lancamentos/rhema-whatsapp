const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

const CANDIDATES = [
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "liquid/lfm-2.5-2.6b:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "recursive/flint-v1.0:free",
];

async function run() {
  for (const model of CANDIDATES) {
    const t0 = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://rhemaimoveis.com.br",
          "X-Title": "Rhema Test",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 100,
          messages: [
            { role: "system", content: "Responda em formato JSON: {\"status\": \"ok\", \"nome\": \"SDR\"}" },
            { role: "user", content: "Olá" },
          ],
        }),
      });
      const ms = Date.now() - t0;
      if (!res.ok) {
        console.log(`❌ ${model} -> HTTP ${res.status} (${ms}ms)`);
      } else {
        const d = await res.json();
        const text = d.choices?.[0]?.message?.content || "";
        console.log(`✅ ${model} -> OK (${ms}ms): ${text.replace(/\s+/g, " ").trim()}`);
      }
    } catch (e: any) {
      console.log(`❌ ${model} -> ERRO: ${e.message}`);
    }
  }
}
run();

