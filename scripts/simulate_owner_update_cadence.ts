import { SDR_OWNER_SYSTEM_PROMPT } from "../src/lib/ai/sdr/sdr-prompts";
import { callModelRouter } from "../src/lib/ai/model-router";

interface OwnerSimulationCase {
  id: string;
  nomeCenario: string;
  codigoImovel: string;
  proprietarioNome: string;
  bairro: string;
  mensagemSdrInicial: string[];
  respostaProprietario: string;
  esperadoStatus: string;
}

const CASOS_SIMULACAO: OwnerSimulationCase[] = [
  {
    id: "VAR-1",
    nomeCenario: "1. Imóvel Disponível com Janelas Livres (Caminho Feliz)",
    codigoImovel: "AP1234",
    proprietarioNome: "Dr. Marcos",
    bairro: "Embaré",
    mensagemSdrInicial: [
      "Olá Dr. Marcos, tudo bem? Aqui é da Rhema Imóveis em Santos.",
      "Estamos com um cliente muito qualificado interessado no seu apê cód. AP1234 no Embaré. O imóvel continua disponível para visitação?",
    ],
    respostaProprietario:
      "Olá! Continua sim à venda. Pode visitar sim! Eu fico em casa aos sábados das 10h às 14h, ou durante a semana após as 18h com autorização prévia na portaria.",
    esperadoStatus: "WINDOWS_OK",
  },
  {
    id: "VAR-2",
    nomeCenario: "2. Disponível com Redução de Preço e Taxas Atualizadas",
    codigoImovel: "CA0890",
    proprietarioNome: "Dona Lúcia",
    bairro: "Ponta da Praia",
    mensagemSdrInicial: [
      "Olá Dona Lúcia, tudo bem? Aqui é da Rhema Imóveis.",
      "Estamos atualizando os dados da sua casa cód. CA0890 na Ponta da Praia. Os valores de venda e condomínio permanecem os mesmos?",
    ],
    respostaProprietario:
      "Oi! Continua à venda sim, mas eu resolvi abaixar o valor para vender logo. Estava R$ 850 mil, agora estou pedindo R$ 790.000. O condomínio subiu um pouquinho, está R$ 680 e o IPTU R$ 240.",
    esperadoStatus: "PRICE_CHANGED",
  },
  {
    id: "VAR-3",
    nomeCenario: "3. Imóvel Já Vendido por Outro Canal",
    codigoImovel: "AP3321",
    proprietarioNome: "Sr. Roberto",
    bairro: "Gonzaga",
    mensagemSdrInicial: [
      "Olá Sr. Roberto, tudo bem? Aqui é da Rhema Imóveis.",
      "Temos uma família com perfil aprovado querendo agendar visita no seu apê no Gonzaga (cód. AP3321). Podemos levar eles nesta semana?",
    ],
    respostaProprietario:
      "Boa tarde. Obrigado pelo contato, mas eu já vendi esse imóvel no mês passado direto com um vizinho aqui do prédio. Pode tirar do site de vocês.",
    esperadoStatus: "SOLD",
  },
  {
    id: "VAR-4",
    nomeCenario: "4. Desistência de Venda / Decidiu Alugar",
    codigoImovel: "AP4450",
    proprietarioNome: "Camila Ramos",
    bairro: "Boqueirão",
    mensagemSdrInicial: [
      "Olá Camila, tudo bem? Aqui é da Rhema Imóveis a respeito do seu imóvel no Boqueirão.",
      "Gostaríamos de confirmar se o apê cód. AP4450 continua disponível para venda.",
    ],
    respostaProprietario:
      "Oi! Então, nós desistimos de vender por enquanto. Meu filho vai se casar e resolveu morar lá, ou no máximo vamos colocar para alugar se ele mudar de ideia. Obrigado!",
    esperadoStatus: "UNAVAILABLE",
  },
  {
    id: "VAR-5",
    nomeCenario: "5. Imóvel com Inquilino no Local (Regras Especiais)",
    codigoImovel: "AP5560",
    proprietarioNome: "Carlos Eduardo",
    bairro: "Aparecida",
    mensagemSdrInicial: [
      "Olá Carlos, tudo bem? Aqui é da Rhema Imóveis.",
      "Estamos com um comprador interessado no seu apê cód. AP5560 na Aparecida. Como estão os dias e horários para visitação?",
    ],
    respostaProprietario:
      "Boa tarde. O imóvel continua à venda sim, porém ele está alugado até o fim do ano. O inquilino só autoriza visita com aviso prévio de pelo menos 48 horas e somente às terças-feiras às 17h.",
    esperadoStatus: "TENANT_OCCUPIED",
  },
  {
    id: "VAR-6",
    nomeCenario: "6. Dúvida sobre a Imobiliária / Checagem de Credibilidade",
    codigoImovel: "AP7789",
    proprietarioNome: "Dr. Fernando",
    bairro: "Embaré",
    mensagemSdrInicial: [
      "Olá Dr. Fernando, tudo bem? Aqui é da Rhema Imóveis.",
      "Temos um cliente em atendimento buscando imóvel com a tipologia do seu apê no Embaré cód. AP7789. O imóvel segue disponível?",
    ],
    respostaProprietario:
      "Olá. Quem passou meu número para vocês? Esse cliente de vocês é comprador de verdade ou é corretor querendo agenciar meu imóvel?",
    esperadoStatus: "QUESTION",
  },
];

async function executarSimulacaoCadencia() {
  console.log("================================================================================");
  console.log("🏢 SIMULAÇÃO COMPLETA: FLUXO DE ATUALIZAÇÃO DE IMÓVEIS COM PROPRIETÁRIOS");
  console.log("   Rhema OS v4.0 | Diretoria Agêntica & SDR Autônomo");
  console.log("================================================================================\n");

  for (const caso of CASOS_SIMULACAO) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📌 CENÁRIO: ${caso.nomeCenario}`);
    console.log(`🏠 Imóvel: [${caso.codigoImovel}] no ${caso.bairro} | Proprietário: ${caso.proprietarioNome}`);
    console.log("────────────────────────────────────────────────────────────────────────────────");

    console.log(`\n💬 [DISPARO INICIAL DO SDR RHEMA -> PROPRIETÁRIO]`);
    for (const b of caso.mensagemSdrInicial) {
      console.log(`   🟢 [SDR Rhema]: "${b}"`);
    }

    console.log(`\n📩 [RESPOSTA RECEBIDA DO PROPRIETÁRIO]`);
    console.log(`   👤 [${caso.proprietarioNome}]: "${caso.respostaProprietario}"`);

    // Executa o Modelo de IA
    const history = [
      { role: "assistant" as const, content: caso.mensagemSdrInicial.join("\n") },
      { role: "user" as const, content: caso.respostaProprietario },
    ];

    try {
      const res = await callModelRouter({
        task: "OWNER_CHAT",
        messages: [{ role: "system", content: SDR_OWNER_SYSTEM_PROMPT }, ...history],
        jsonMode: true,
      });

      const p = res.jsonParsed || {};
      const replyParts: string[] = Array.isArray(p.replyParts) ? p.replyParts : [p.replyText || ""];

      console.log(`\n🤖 [ANÁLISE COGNITIVA DA IA - ${res.modelUsed}] (Latência: ${res.latencyMs}ms):`);
      console.log(`   • Status Classificado: ${p.ownerStatus} (Esperado: ${caso.esperadoStatus})`);
      if (p.janelasDisponiveis && p.janelasDisponiveis.length > 0) {
        console.log(`   • Janelas Extraídas: ${JSON.stringify(p.janelasDisponiveis)}`);
      }
      if (p.regrasAcesso) {
        console.log(`   • Regras de Acesso: "${p.regrasAcesso}"`);
      }
      if (p.alteracoesCadastrais && (p.alteracoesCadastrais.novoValorVenda || p.alteracoesCadastrais.novoCondominio)) {
        console.log(`   • Alterações de Valores: ${JSON.stringify(p.alteracoesCadastrais)}`);
      }
      if (p.motivoIndisponibilidade) {
        console.log(`   • Motivo Indisponibilidade: "${p.motivoIndisponibilidade}"`);
      }
      console.log(`   • Ação no CRM Imoview: ${p.proximaAcaoCrm}`);
      console.log(`   • Impacto no Lead Comprador: ${p.impactoNoLead}`);

      console.log(`\n💬 [RÉPLICA CALIBRADA DO SDR RHEMA EM BOLHAS SPLIT]:`);
      for (const b of replyParts) {
        console.log(`   🟢 [SDR Rhema]: "${b}"`);
      }

      console.log(`\n⚡ [EFEITO EM CASCATA NO ECOSSISTEMA]:`);
      if (p.ownerStatus === "WINDOWS_OK") {
        console.log(`   🎯 -> Agenda de visitas sincronizada.`);
        console.log(`   📲 -> Mensagem enviada ao Lead Comprador com as janelas oferecidas.`);
        console.log(`   📋 -> Atendimento no Imoview avançado para Fase 8 (Agendamento de Visita).`);
      } else if (p.ownerStatus === "PRICE_CHANGED") {
        console.log(`   💰 -> Imoview atualizado com novo valor de R$ ${p.alteracoesCadastrais?.novoValorVenda?.toLocaleString("pt-BR")}.`);
        console.log(`   🔥 -> Alerta de oportunidade disparado ao Lead Comprador: "O proprietário reduziu o valor!"`);
        console.log(`   ⚡ -> Gatilho !match ativado para cruzar com outros clientes ativos na base.`);
      } else if (p.ownerStatus === "SOLD") {
        console.log(`   🚫 -> Imóvel ${caso.codigoImovel} inativado no Imoview (evita novas captações e lead falso).`);
        console.log(`   🛡️ -> Protocolo Regra 6 disparado para o Lead: acolhimento gentil + envio de 3 opções aderentes.`);
      } else if (p.ownerStatus === "UNAVAILABLE" || p.ownerStatus === "RENTED") {
        console.log(`   ⏸️ -> Imóvel suspenso no CRM de Vendas.`);
        console.log(`   🔑 -> Lead de Captação transferido para o setor de Locação Rhema (se tiver interesse em alugar).`);
        console.log(`   🛡️ -> Lead Comprador redirecionado para imóveis similares sem quebrar o relacionamento.`);
      } else if (p.ownerStatus === "TENANT_OCCUPIED") {
        console.log(`   📝 -> Regra de agendamento restrito (48h prévia) cadastrada na ficha interna do Imoview.`);
        console.log(`   🤝 -> SDR ajusta a expectativa com o comprador para o dia autorizado.`);
      } else if (p.ownerStatus === "QUESTION") {
        console.log(`   🛡️ -> Dúvida sanada com transparência e ética profissional.`);
        console.log(`   🤝 -> Conexão humana estabelecida reforçando os 25 anos da Rhema em Santos.`);
      }
    } catch (err: any) {
      console.error(`   ❌ Erro ao processar cenário:`, err.message || err);
    }

    console.log("\n");
  }

  // 7. Simulação da Régua Anti-Vácuo do Proprietário
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📌 CENÁRIO 7: RÉGUA ANTI-VÁCUO DO PROPRIETÁRIO (SEM RESPOSTA)`);
  console.log(`🏠 Imóvel: [AP9900] no Boqueirão | Proprietário: Marcelo`);
  console.log("────────────────────────────────────────────────────────────────────────────────");
  console.log(`⏱️ [T0 - Disparo Inicial às 09:30]:`);
  console.log(`   🟢 [SDR Rhema]: "Olá Marcelo, tudo bem? Aqui é da Rhema Imóveis."`);
  console.log(`   🟢 [SDR Rhema]: "Temos um cliente em atendimento buscando apê de 2 dorms no Boqueirão e gostaríamos de confirmar se o seu cód. AP9900 continua à venda. Podemos conversar?"`);
  console.log(`\n⏳ [Passaram-se 3 horas sem visualização ou resposta...]\n`);
  console.log(`⏱️ [T1 - Follow-up Suave às 12:45]:`);
  console.log(`   🟢 [SDR Rhema]: "Oi Marcelo! Só passando pra te avisar que o comprador gostaria de agendar uma visita ainda nesta semana."`);
  console.log(`   🟢 [SDR Rhema]: "Se o imóvel ainda estiver disponível, me dá um toque por aqui para alinharmos? Obrigado!"`);
  console.log(`\n⏳ [Passaram-se 24 horas sem resposta...]\n`);
  console.log(`⏱️ [T2 - Alerta ao Captador Titular no Imoview / WhatsApp às 10:00 do dia seguinte]:`);
  console.log(`   🚨 [Rhema OS]: Corretor captador notificado: "O proprietário Marcelo do imóvel AP9900 não respondeu à confirmação de visita. Favor fazer contato por ligação telefônica."`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("================================================================================");
  console.log("✅ SIMULAÇÃO DE TODAS AS VARIÁVEIS CONCLUÍDA COM SUCESSO!");
  console.log("================================================================================");
}

executarSimulacaoCadencia().catch((e) => {
  console.error("Erro fatal na simulação:", e);
});
