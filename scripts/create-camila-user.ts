import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const phone = "13991588225";
  const fullPhone = "5513991588225";
  const email = "13991588225@rhemaimoveis.com.br";
  const defaultPassword = "Rhema@2026!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  console.log("=== CRIANDO / ATUALIZANDO USUÁRIO DA CAMILA ===");

  // 1. Verificar se já existe
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { phone },
        { phone: fullPhone },
        { email: "camila@rhemaimoveis.com.br" },
      ],
    },
  });

  let userId: string;

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: "Camila",
        phone: fullPhone,
        email: email,
        password: hashedPassword,
        role: Role.ADMIN,
        isActive: true,
        mustChangePassword: false,
      },
    });
    userId = updated.id;
    console.log(`✅ Usuário da Camila atualizado com sucesso! ID: ${userId}`);
  } else {
    const created = await prisma.user.create({
      data: {
        name: "Camila",
        email: email,
        phone: fullPhone,
        password: hashedPassword,
        role: Role.ADMIN,
        isActive: true,
        mustChangePassword: false,
      },
    });
    userId = created.id;
    console.log(`✅ Usuário da Camila criado com sucesso! ID: ${userId}`);
  }

  // 2. Garantir acesso à sessão WhatsApp avg78n
  const session = await prisma.session.findUnique({
    where: { sessionId: "avg78n" },
  });

  if (session) {
    const existingAccess = await prisma.sessionAccess.findUnique({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: userId,
        },
      },
    });

    if (!existingAccess) {
      await prisma.sessionAccess.create({
        data: {
          sessionId: session.id,
          userId: userId,
        },
      });
      console.log(`✅ Acesso à sessão WhatsApp 'avg78n' concedido para a Camila!`);
    } else {
      console.log(`ℹ️ Acesso à sessão 'avg78n' já estava concedido.`);
    }
  }

  console.log(`\n🎉 Credenciais de Acesso da Camila:`);
  console.log(`- Login (WhatsApp ou Email): 13991588225 ou ${email}`);
  console.log(`- Senha: ${defaultPassword}`);
  console.log(`- Nível de Acesso: ADMIN (acesso total a disparos, chat, contatos e listas)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
