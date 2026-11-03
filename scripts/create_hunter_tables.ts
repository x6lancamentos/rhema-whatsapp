import { prisma } from "../src/lib/prisma";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "HunterConfig" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
      "bairrosSantos" JSONB NOT NULL,
      "valorMin" DOUBLE PRECISION NOT NULL DEFAULT 350000,
      "valorMax" DOUBLE PRECISION NOT NULL DEFAULT 2500000,
      "tiposImovel" JSONB NOT NULL,
      "limiteDiario" INTEGER NOT NULL DEFAULT 15,
      "delayMinSeg" INTEGER NOT NULL DEFAULT 45,
      "delayMaxSeg" INTEGER NOT NULL DEFAULT 180,
      "ativo" BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,

  `CREATE TABLE IF NOT EXISTS "HunterOpportunity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "fonte" TEXT NOT NULL,
      "externalId" TEXT UNIQUE,
      "tipoOportunidade" TEXT NOT NULL,
      "titulo" TEXT,
      "bairro" TEXT NOT NULL,
      "cidade" TEXT NOT NULL DEFAULT 'Santos',
      "tipoImovel" TEXT NOT NULL,
      "valorPretendido" DOUBLE PRECISION NOT NULL,
      "condominio" DOUBLE PRECISION,
      "iptu" DOUBLE PRECISION,
      "quartos" INTEGER,
      "vagas" INTEGER,
      "areaM2" DOUBLE PRECISION,
      "enderecoAprox" TEXT,
      "fotosOrigem" JSONB,
      "dadosEemovel" JSONB,
      "proprietarioNome" TEXT NOT NULL,
      "proprietarioTelefone" TEXT NOT NULL,
      "proprietarioJid" TEXT NOT NULL,
      "perfilPsicometrico" JSONB,
      "scoreParticular" INTEGER NOT NULL DEFAULT 100,
      "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
      "notificadoBrunnoEm" TIMESTAMP(3),
      "corretorDesignado" TEXT,
      "visitaAgendadaEm" TIMESTAMP(3),
      "fichaDigitalId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "HunterOpportunity_proprietarioTelefone_idx" ON "HunterOpportunity"("proprietarioTelefone")`,
  `CREATE INDEX IF NOT EXISTS "HunterOpportunity_status_idx" ON "HunterOpportunity"("status")`,
  `CREATE INDEX IF NOT EXISTS "HunterOpportunity_bairro_idx" ON "HunterOpportunity"("bairro")`,
  `CREATE INDEX IF NOT EXISTS "HunterOpportunity_tipoOportunidade_idx" ON "HunterOpportunity"("tipoOportunidade")`,

  `CREATE TABLE IF NOT EXISTS "HunterCadenceLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "opportunityId" TEXT NOT NULL REFERENCES "HunterOpportunity"("id") ON DELETE CASCADE,
      "direcao" TEXT NOT NULL,
      "tipo" TEXT NOT NULL,
      "conteudo" TEXT NOT NULL,
      "analiseCoach" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "HunterCadenceLog_opportunityId_createdAt_idx" ON "HunterCadenceLog"("opportunityId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "PromptEvolutionProposal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "learnId" TEXT NOT NULL UNIQUE,
      "modulo" TEXT NOT NULL,
      "titulo" TEXT NOT NULL,
      "motivoAprimoramento" TEXT NOT NULL,
      "promptAntes" TEXT NOT NULL,
      "promptDepois" TEXT NOT NULL,
      "diffResumo" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "aprovadoPor" TEXT,
      "aprovadoEm" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "PromptEvolutionProposal_status_idx" ON "PromptEvolutionProposal"("status")`,
  `CREATE INDEX IF NOT EXISTS "PromptEvolutionProposal_modulo_idx" ON "PromptEvolutionProposal"("modulo")`,

  `CREATE TABLE IF NOT EXISTS "AgentDebateMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "proposalId" TEXT,
      "remetente" TEXT NOT NULL,
      "conteudo" TEXT NOT NULL,
      "metadados" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "AgentDebateMessage_createdAt_idx" ON "AgentDebateMessage"("createdAt")`,
];

async function run() {
  console.log("=== CRIANDO TABELAS DO RHEMA HUNTER E AUTO-EVOLUÇÃO (SEM DROP) ===");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }

  // Seed inicial de configuração do Hunter se não existir
  const existingConfig = await prisma.hunterConfig.findUnique({ where: { id: "default" } });
  if (!existingConfig) {
    await prisma.hunterConfig.create({
      data: {
        id: "default",
        bairrosSantos: [
          "Embaré",
          "Gonzaga",
          "Ponta da Praia",
          "Boqueirão",
          "Aparecida",
          "Pompéia",
          "Campo Grande",
          "Marapé",
          "José Menino",
        ],
        valorMin: 350000,
        valorMax: 2500000,
        tiposImovel: ["Apartamento", "Casa", "Cobertura"],
        limiteDiario: 15,
        delayMinSeg: 45,
        delayMaxSeg: 180,
        ativo: true,
      },
    });
    console.log("✅ Configuração inicial do Hunter inserida com os bairros da orla de Santos!");
  }

  console.log("✅ Todas as tabelas do Rhema Hunter criadas com sucesso!");
  process.exit(0);
}

run().catch((e) => {
  console.error("Erro ao criar tabelas do Hunter:", e);
  process.exit(1);
});
