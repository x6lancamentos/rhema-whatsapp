import { formatPropertyDetailsUrl } from "../src/lib/ai/sdr/property-matcher";
import { isWithinBusinessHours } from "../src/lib/ai/sdr/sdr-followup";
import { resolveImoviewBrokerId } from "../src/lib/ai/sdr/broker-assignment";

async function runTestSuite() {
  console.log("==========================================");
  console.log("🧪 EXECUTANDO SUÍTE DE TESTES SDR AUTÔNOMO");
  console.log("==========================================\n");

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${detail ? `-> ${detail}` : ""}`);
    }
  }

  // 1. Teste de URL oficial de detalhes do imóvel
  console.log("--- 1. Padrão Oficial de URL de Imóveis Rhema ---");
  const url1 = formatPropertyDetailsUrl("AP1234");
  assert(
    "Geração de URL para AP1234",
    url1 === "https://www.rhemaimoveis.com.br/imovel/detalhes/AP1234",
    `Recebido: ${url1}`
  );

  const url2 = formatPropertyDetailsUrl("ca-9988");
  assert(
    "Geração de URL para ca-9988",
    url2 === "https://www.rhemaimoveis.com.br/imovel/detalhes/ca-9988",
    `Recebido: ${url2}`
  );

  // 2. Teste de Horário Comercial (Seg-Sáb: 08:00-21:00 / Dom: 09:00-18:00)
  console.log("\n--- 2. Gestão de Horário Comercial / Modo Noturno ---");
  // Segunda-feira às 10h (Horário de Brasília)
  const mondayMorning = new Date("2026-11-02T13:00:00Z"); // 10:00 BRT
  assert(
    "Segunda-feira 10h está dentro do horário comercial",
    isWithinBusinessHours(mondayMorning) === true
  );

  // Segunda-feira às 23h (Horário de Brasília)
  const mondayLateNight = new Date("2026-11-03T02:00:00Z"); // 23:00 BRT
  assert(
    "Segunda-feira 23h está FORA do horário comercial (Modo Noturno)",
    isWithinBusinessHours(mondayLateNight) === false
  );

  // Segunda-feira às 05h (Horário de Brasília)
  const mondayDawn = new Date("2026-11-02T08:00:00Z"); // 05:00 BRT
  assert(
    "Segunda-feira 05h está FORA do horário comercial",
    isWithinBusinessHours(mondayDawn) === false
  );

  // Domingo às 12h (Horário de Brasília)
  const sundayNoon = new Date("2026-11-01T15:00:00Z"); // 12:00 BRT
  assert(
    "Domingo 12h está dentro do horário comercial",
    isWithinBusinessHours(sundayNoon) === true
  );

  // Domingo às 08h (Horário de Brasília) - Domingo abre só às 09h
  const sundayEarly = new Date("2026-11-01T11:00:00Z"); // 08:00 BRT
  assert(
    "Domingo 08h está FORA do horário comercial (abre às 09h)",
    isWithinBusinessHours(sundayEarly) === false
  );

  // Domingo às 19h (Horário de Brasília) - Domingo encerra às 18h
  const sundayNight = new Date("2026-11-01T22:00:00Z"); // 19:00 BRT
  assert(
    "Domingo 19h está FORA do horário comercial (fecha às 18h)",
    isWithinBusinessHours(sundayNight) === false
  );

  // 3. Teste de Mapeamento de Corretores Rhema
  console.log("\n--- 3. Mapeamento de Corretores no Imoview ---");
  assert("André Felipe mapeia para ID 24", resolveImoviewBrokerId("André Felipe") === 24);
  assert("Tatiana mapeia para ID 13", resolveImoviewBrokerId("Tatiana") === 13);
  assert("Elaine mapeia para ID 14", resolveImoviewBrokerId("Elaine") === 14);
  assert("Flávia mapeia para ID 20", resolveImoviewBrokerId("Flávia") === 20);
  assert("Brunno Anastácio mapeia para ID 8", resolveImoviewBrokerId("Brunno Anastácio") === 8);

  console.log("\n==========================================");
  console.log(`📊 RESULTADO DOS TESTES: ${passed}/${total} APROVADOS`);
  console.log("==========================================");

  if (passed === total) {
    console.log("🎉 TODOS OS TESTES PASSARAM COM SUCESSO!");
    process.exit(0);
  } else {
    console.error("❌ ALGUNS TESTES FALHARAM!");
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error("Erro fatal na suíte de testes:", e);
  process.exit(1);
});
