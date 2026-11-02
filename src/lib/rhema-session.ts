import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Obtém a sessão do Baileys correspondente ao Gestor Comandante (Brunno Gerência).
 * Prioridade:
 * 1. sessionId explícito no .env (RHEMA_GESTOR_SESSION_ID)
 * 2. Sessão cujo nome contenha "Brunno" ou "Gerente"
 * 3. Fallback seguro por ID conhecido ("5mhrx9")
 */
export async function getGestorSession() {
  const targetId = process.env.RHEMA_GESTOR_SESSION_ID || "5mhrx9";

  // 1. Tenta pelo ID exato configurado
  let session = await prisma.session.findUnique({
    where: { sessionId: targetId },
  });

  // 2. Se não encontrar, busca por nome que identifique a gerência
  if (!session) {
    session = await prisma.session.findFirst({
      where: {
        OR: [
          { name: { contains: "Brunno", mode: "insensitive" } },
          { name: { contains: "Gerente", mode: "insensitive" } },
        ],
      },
    });
  }

  if (!session) {
    logger.warn(
      "RhemaSession",
      `Sessão do Gestor (${targetId}) não foi encontrada no banco. Verifique as credenciais no banco.`
    );
  }

  return session;
}

/**
 * Obtém a sessão institucional da Rhema Imóveis (Bot institucional).
 */
export async function getInstitutionalSession() {
  const targetId = process.env.RHEMA_INSTITUTIONAL_SESSION_ID || "59n5i";

  let session = await prisma.session.findUnique({
    where: { sessionId: targetId },
  });

  if (!session) {
    session = await prisma.session.findFirst({
      where: {
        name: { contains: "Rhema", mode: "insensitive" },
      },
    });
  }

  return session;
}

/**
 * Retorna o telefone pessoal do Brunno para alertas executivos e testes.
 */
export function getGestorPersonalPhone(): string {
  return process.env.RHEMA_GESTOR_PERSONAL_PHONE || "556293856483";
}

/**
 * Retorna o JID do WhatsApp pessoal do Brunno.
 */
export function getGestorPersonalJid(): string {
  const phone = getGestorPersonalPhone().replace(/\D/g, "");
  return phone.startsWith("55") ? `${phone}@s.whatsapp.net` : `55${phone}@s.whatsapp.net`;
}

