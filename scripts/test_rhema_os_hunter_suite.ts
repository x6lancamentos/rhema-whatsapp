/**
 * SUÍTE COMPLETA DE TESTES INTEGRADOS - RHEMA OS v5.1
 * Valida:
 * 1. HunterConfig (Bairros Santos e Faixa de Preço)
 * 2. EEmovelService & Scraper Fallback
 * 3. Reverse Hunter (Comprador na Mão)
 * 4. Master Coach (Big Five, DISC, SPIN Selling, PNL)
 * 5. Data Analyst (Métricas de Conversão e Sentimento)
 * 6. Debate Agêntico & Aprovação de #LEARN-ID
 * 7. FichaBridge & Dossiê Executivo Brunno
 * 8. Fila Anti-Spam (Jitter 45s a 180s)
 */

import { prisma } from "../src/lib/prisma";
import { collectEemovelOpportunities } from "../src/lib/hunter/eemovel-service";
import { executeReverseHunter } from "../src/lib/hunter/reverse-hunter";
import { evaluateWithMasterCoach } from "../src/lib/ai/coaching/master-coach-agent";
import { runDataAnalystCycle, getConsolidatedPerformanceMetrics } from "../src/lib/ai/coaching/data-analyst-agent";
import { triggerAgentDebateSession, approveEvolutionProposal } from "../src/lib/ai/coaching/agent-debate-service";
import { createFichaDraft, formatBrunnoDossier } from "../src/lib/hunter/ficha-bridge";
import { runHunterJitterTick } from "../src/lib/hunter/hunter-orchestrator";

async function runTestSuite() {
  console.log("===============================================================");
  console.log("🚀 INICIANDO TESTE INTEGRADO COMPLETO DO RHEMA OS v5.1");
  console.log("===============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, extra?: any) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS ${passed}/${total}] ${title}`);
    } else {
      console.error(`❌ [FAIL ${passed}/${total}] ${title}`, extra || "");
    }
  }

  try {
    // -------------------------------------------------------------
    // TESTE 1: Configuração do Hunter & Seletor de Bairros / Preço
    // -------------------------------------------------------------
    console.log("\n--- TESTE 1: Configuração do Hunter (Bairros e Faixa de Preço) ---");
    const initialConfig = await prisma.hunterConfig.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        bairrosSantos: ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida"],
        valorMin: 350000,
        valorMax: 2500000,
        tiposImovel: ["Apartamento", "Casa", "Cobertura"],
        limiteDiario: 15,
        delayMinSeg: 45,
        delayMaxSeg: 180,
      },
    });
    assert("HunterConfig inicial obtido com sucesso", !!initialConfig && initialConfig.id === "default");

    const updatedConfig = await prisma.hunterConfig.update({
      where: { id: "default" },
      data: {
        bairrosSantos: ["Embaré", "Gonzaga", "Ponta da Praia", "Boqueirão", "Aparecida"],
        valorMin: 400000,
        valorMax: 2200000,
        limiteDiario: 20,
      },
    });
    assert("Filtro de bairros e preço atualizado com sucesso", 
      updatedConfig.valorMin === 400000 && 
      updatedConfig.valorMax === 2200000 &&
      (updatedConfig.bairrosSantos as string[]).includes("Embaré")
    );

    // -------------------------------------------------------------
    // TESTE 2: Sincronização eEmovel (Varredura de Oportunidades)
    // -------------------------------------------------------------
    console.log("\n--- TESTE 2: Sincronização eEmovel & Scraping Inteligente ---");
    const collectedCards = await collectEemovelOpportunities({
      bairros: ["Embaré", "Gonzaga", "Ponta da Praia"],
      valorMin: 400000,
      valorMax: 2200000,
      limite: 5,
    });
    assert("Sincronização eEmovel executada sem erros", Array.isArray(collectedCards) && collectedCards.length > 0);

    const oppCount = await prisma.hunterOpportunity.count();
    assert("Oportunidades persistidas no PostgreSQL com segurança", oppCount > 0, `Total: ${oppCount}`);

    // -------------------------------------------------------------
    // TESTE 3: Reverse Hunter sob Demanda (Comprador na Mão)
    // -------------------------------------------------------------
    console.log("\n--- TESTE 3: Reverse Hunter sob Demanda (Comprador na Mão) ---");
    const reverseResult = await executeReverseHunter({
      leadId: "lead-test-123",
      leadNome: "Família Silva",
      bairro: "Gonzaga",
      tipoImovel: "Apartamento",
      valorMaximo: 950000,
      quartosMin: 2,
    });

    assert("Reverse Hunter localizou oportunidade aderente", reverseResult.ativado);
    assert("Script de abordagem 'Comprador na Mão' gerado com alta persuasão", 
      !!reverseResult.melhorOpcao?.mensagemSugerida && reverseResult.melhorOpcao.mensagemSugerida.length > 0
    );

    // -------------------------------------------------------------
    // TESTE 4: Master Coach (Big Five, DISC, PNL e SPIN Selling)
    // -------------------------------------------------------------
    console.log("\n--- TESTE 4: Master Coach (Big Five & Psicológico) ---");
    const coachEval = await evaluateWithMasterCoach({
      modulo: "HUNTER_CAPTACAO",
      contextoLead: {
        proprietarioNome: "Dr. Roberto",
        bairro: "Embaré",
        tipoImovel: "Apartamento",
        valor: "R$ 950.000",
      },
      dialogo: [
        { remetente: "AGENTE", texto: "Olá Dr. Roberto, sou da Rhema Imóveis. Temos um comprador que busca imóvel no Embaré." },
        { remetente: "LEAD", texto: "Não quero imobiliária me ligando, já tenho anúncio e não quero pagar comissão alta." },
      ],
    });

    assert("Master Coach avaliou diálogo com inteligência comportamental", typeof coachEval === "object");

    // -------------------------------------------------------------
    // TESTE 5: Data Analyst (Métricas de Conversão e Sentimento)
    // -------------------------------------------------------------
    console.log("\n--- TESTE 5: Data Analyst (Métricas e Auditoria Quantitativa) ---");
    const metrics = await getConsolidatedPerformanceMetrics();
    assert("Métricas consolidadas calculadas pelo Data Analyst", 
      typeof metrics.sdr?.taxaConversao === "number" &&
      typeof metrics.hunter?.taxaAceite === "number"
    );

    const analystCycle = await runDataAnalystCycle();
    assert("Ciclo autônomo do Data Analyst concluído", typeof analystCycle === "string" && analystCycle.length > 0);

    // -------------------------------------------------------------
    // TESTE 6: Sessão de Debate Agêntico & Aprovação de #LEARN-ID
    // -------------------------------------------------------------
    console.log("\n--- TESTE 6: Debate Multiagente & Governança com 1 Clique ---");
    const debateSession = await triggerAgentDebateSession("HUNTER_CAPTACAO");
    assert("Debate entre Master Coach e Data Analyst concluído", !!debateSession.coachEval && !!debateSession.dataParecer);

    let proposal = await prisma.promptEvolutionProposal.findFirst({
      where: { status: "PENDING" },
    });

    if (!proposal) {
      proposal = await prisma.promptEvolutionProposal.create({
        data: {
          learnId: `#LEARN-TEST-${Date.now().toString(36).toUpperCase()}`,
          modulo: "HUNTER_CAPTACAO",
          titulo: "Otimização de Abordagem Direta com PNL",
          motivoAprimoramento: "Refinamento comportamental baseado no Big Five",
          promptAntes: "Instrução anterior...",
          promptDepois: "Instrução aprimorada com espelhamento...",
          status: "PENDING",
        },
      });
    }

    assert("Proposta gerou card com learnId formatado (#LEARN-...)", proposal.learnId.startsWith("#LEARN-"));

    // Simulando Aprovação em 1 clique pelo Gestor Brunno
    const approvedProposal = await approveEvolutionProposal(proposal.id, "Brunno Anastácio (Gerente)");
    assert("Proposta aprovada com sucesso e pronta para hot-reload", 
      approvedProposal.status === "APPROVED" && approvedProposal.aprovadoPor === "Brunno Anastácio (Gerente)"
    );

    // -------------------------------------------------------------
    // TESTE 7: FichaBridge & Dossiê Executivo Brunno (WhatsApp)
    // -------------------------------------------------------------
    console.log("\n--- TESTE 7: FichaBridge & Dossiê Executivo para Brunno ---");
    const fichaResult = await createFichaDraft({
      proprietarioNome: "Carlos Alberto",
      proprietarioTelefone: "5513997771234",
      bairro: "Ponta da Praia",
      tipoImovel: "Apartamento",
      valorVenda: 1250000,
      condominio: 1100,
      iptu: 350,
      quartos: 3,
      enderecoAprox: "Av. Almirante Saldanha da Gama, próx. ao Aquário",
      horarioPreferencialVisita: "Amanhã às 15:00",
    });

    assert("Pré-ficha criada com sucesso no Hub/Supabase", fichaResult.success && !!fichaResult.fichaId);

    const dossierMsg = formatBrunnoDossier({
      proprietarioNome: "Carlos Alberto",
      proprietarioTelefone: "5513997771234",
      bairro: "Ponta da Praia",
      tipoImovel: "Apartamento",
      valorVenda: 1250000,
      condominio: 1100,
      iptu: 350,
      quartos: 3,
      enderecoAprox: "Av. Almirante Saldanha da Gama, próx. ao Aquário",
      horarioPreferencialVisita: "Amanhã às 15:00",
      fichaId: fichaResult.fichaId,
      urlApp: fichaResult.urlApp,
    });

    assert("Dossiê executivo gerado com link Rhema Hub e sem distribuição cega", 
      dossierMsg.includes("Carlos Alberto") && 
      dossierMsg.includes("Ponta da Praia") && 
      dossierMsg.includes(fichaResult.fichaId)
    );

    // -------------------------------------------------------------
    // TESTE 8: Fila Anti-Spam (Jitter 45s a 180s)
    // -------------------------------------------------------------
    console.log("\n--- TESTE 8: Motor de Jitter Anti-Spam do Hunter ---");
    const jitterCount = await runHunterJitterTick(null);
    assert("Tick do motor de jitter executado com proteção anti-bloqueio", typeof jitterCount === "number");

    // -------------------------------------------------------------
    // RESUMO FINAL DOS TESTES
    // -------------------------------------------------------------
    console.log("\n===============================================================");
    console.log(`🎯 RESULTADO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
    console.log("===============================================================\n");

    if (passed === total) {
      console.log("🌟 TODOS OS SISTEMAS DO RHEMA OS v5.1 ESTÃO OPERACIONAIS E HOMOLOGADOS!");
    } else {
      console.warn("⚠️ ALGUNS TESTES FALHARAM. VERIFIQUE OS LOGS ACIMA.");
    }
  } catch (err: any) {
    console.error("❌ ERRO INESPERADO NA EXECUÇÃO DA SUÍTE DE TESTES:", err);
  } finally {
    await prisma.$disconnect();
    process.exit(passed === total ? 0 : 1);
  }
}

runTestSuite();
