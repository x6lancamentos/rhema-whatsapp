import { prisma } from "../src/lib/prisma";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "SdrLead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "leadNome" TEXT NOT NULL,
      "leadPhone" TEXT NOT NULL,
      "leadJid" TEXT NOT NULL,
      "origem" TEXT,
      "codigoImovel" TEXT,
      "imovelSnapshot" JSONB,
      "observacoesCamila" TEXT,
      "rawIntakeText" TEXT NOT NULL,
      "intakeMessageId" TEXT UNIQUE,
      "pilares" JSONB,
      "temperatura" TEXT DEFAULT 'MORNO',
      "perfilExtraido" JSONB,
      "alternativasEnviadas" JSONB,
      "ownerPhone" TEXT,
      "ownerStatus" TEXT DEFAULT 'PENDING',
      "ownerWindows" JSONB,
      "visitaDataHora" TIMESTAMP(3),
      "visitaImovel" TEXT,
      "imoviewAtendimento" INTEGER,
      "corretorId" INTEGER,
      "corretorNome" TEXT,
      "criterioDistribuicao" TEXT,
      "followupCount" INTEGER NOT NULL DEFAULT 0,
      "nextFollowupAt" TIMESTAMP(3),
      "sessionId" TEXT NOT NULL DEFAULT '5mhrx9',
      "supervised" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "SdrLead_leadPhone_idx" ON "SdrLead"("leadPhone")`,
  `CREATE INDEX IF NOT EXISTS "SdrLead_status_idx" ON "SdrLead"("status")`,
  `CREATE INDEX IF NOT EXISTS "SdrLead_nextFollowupAt_idx" ON "SdrLead"("nextFollowupAt")`,
  `CREATE INDEX IF NOT EXISTS "SdrLead_createdAt_idx" ON "SdrLead"("createdAt")`,

  `CREATE TABLE IF NOT EXISTS "SdrConversation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sdrLeadId" TEXT NOT NULL REFERENCES "SdrLead"("id") ON DELETE CASCADE,
      "role" TEXT NOT NULL,
      "jid" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "summary" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "SdrConversation_jid_status_idx" ON "SdrConversation"("jid", "status")`,
  `CREATE INDEX IF NOT EXISTS "SdrConversation_phone_idx" ON "SdrConversation"("phone")`,

  `CREATE TABLE IF NOT EXISTS "SdrMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL REFERENCES "SdrConversation"("id") ON DELETE CASCADE,
      "direction" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "modelUsed" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "SdrMessage_conversationId_createdAt_idx" ON "SdrMessage"("conversationId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "AiModelStat" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "task" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "success" BOOLEAN NOT NULL,
      "jsonValid" BOOLEAN,
      "latencyMs" INTEGER NOT NULL,
      "errorCode" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "AiModelStat_task_model_createdAt_idx" ON "AiModelStat"("task", "model", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "SdrLearningInsight" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sdrLeadId" TEXT REFERENCES "SdrLead"("id") ON DELETE SET NULL,
      "tipo" TEXT NOT NULL,
      "titulo" TEXT NOT NULL,
      "diagnostico" TEXT NOT NULL,
      "sugestaoAcao" TEXT NOT NULL,
      "notificadoGrupoSdr" BOOLEAN NOT NULL DEFAULT false,
      "notificadoEm" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "SdrLearningInsight_tipo_idx" ON "SdrLearningInsight"("tipo")`,
  `CREATE INDEX IF NOT EXISTS "SdrLearningInsight_notificadoGrupoSdr_idx" ON "SdrLearningInsight"("notificadoGrupoSdr")`,
  `CREATE INDEX IF NOT EXISTS "SdrLearningInsight_createdAt_idx" ON "SdrLearningInsight"("createdAt")`,
];

async function main() {
  console.log("=== CRIANDO TABELAS DO SDR COM SEGURANÇA (SEM DROP) ===");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("✅ Todas as tabelas e índices criados com sucesso!");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
