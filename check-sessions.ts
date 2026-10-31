import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.session.findMany();
  console.log("=== SESSOES WHATSAPP ===");
  sessions.forEach(s => {
    console.log(`ID: ${s.id} | SessionId: ${s.sessionId} | Status: ${s.status} | Phone: ${(s as any).phoneNumber || s.name} | Updated: ${s.updatedAt}`);
  });
}

main().finally(() => prisma.$disconnect());

