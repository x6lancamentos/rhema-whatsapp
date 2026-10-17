import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BROKERS_DATA = [
  {
    nome: "Ana Maria dos Santos Lisboa",
    shortName: "Ana Maria",
    phoneDddNum: "13991673717",
    fullPhone: "5513991673717",
    imoviewCodigo: "6",
    equipe: "Vendas",
  },
  {
    nome: "Elaine do Nascimento",
    shortName: "Elaine",
    phoneDddNum: "13976008877",
    fullPhone: "5513976008877",
    imoviewCodigo: "14",
    equipe: "Vendas",
  },
  {
    nome: "Flávia",
    shortName: "Flávia",
    phoneDddNum: "15974042000",
    fullPhone: "5515974042000",
    imoviewCodigo: null,
    equipe: "Vendas",
  },
  {
    nome: "Kaylane Assumpção",
    shortName: "Kaylane",
    phoneDddNum: "13992123879",
    fullPhone: "5513992123879",
    imoviewCodigo: "16",
    equipe: "Vendas",
  },
  {
    nome: "Leniára R. M. Araújo",
    shortName: "Leniára",
    phoneDddNum: "13996461664",
    fullPhone: "5513996461664",
    imoviewCodigo: "12",
    equipe: "Vendas",
  },
  {
    nome: "Luana Cardoso",
    shortName: "Luana",
    phoneDddNum: "13996960556",
    fullPhone: "5513996960556",
    imoviewCodigo: "19",
    equipe: "Vendas",
  },
  {
    nome: "Roseli de Carvalho Lopes",
    shortName: "Roseli",
    phoneDddNum: "13974103368",
    fullPhone: "5513974103368",
    imoviewCodigo: "11",
    equipe: "Vendas",
  },
  {
    nome: "Tatiana Gonçalves de Oliveira",
    shortName: "Tatiana",
    phoneDddNum: "13981854677",
    fullPhone: "5513981854677",
    imoviewCodigo: "13",
    equipe: "Vendas",
  },
  {
    nome: "Ulisses Dias Vieira",
    shortName: "Ulisses Consultor",
    phoneDddNum: "13988181515",
    fullPhone: "5513988181515",
    imoviewCodigo: "25",
    equipe: "Vendas",
  },
  {
    nome: "André",
    shortName: "André | Candidato Rhema",
    phoneDddNum: "13981404451",
    fullPhone: "5513981404451",
    imoviewCodigo: null,
    equipe: "Vendas",
  },
];

async function main() {
  const defaultPassword = "Rhema@2026!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  console.log(`Iniciando cadastro/atualização de ${BROKERS_DATA.length} corretores...`);

  for (const b of BROKERS_DATA) {
    // 1. Cadastrar / Atualizar na tabela BrokerContact
    const existingContact = await prisma.brokerContact.findFirst({
      where: {
        OR: [
          { telefone: b.fullPhone },
          { telefone: b.phoneDddNum },
          ...(b.imoviewCodigo ? [{ imoviewCodigo: b.imoviewCodigo }] : []),
          { nome: b.nome },
        ],
      },
    });

    if (existingContact) {
      await prisma.brokerContact.update({
        where: { id: existingContact.id },
        data: {
          nome: b.nome,
          telefone: b.fullPhone,
          imoviewCodigo: b.imoviewCodigo || existingContact.imoviewCodigo,
          ativo: true,
          equipe: b.equipe,
        },
      });
      console.log(`[BrokerContact] Atualizado: ${b.nome} (${b.fullPhone})`);
    } else {
      await prisma.brokerContact.create({
        data: {
          nome: b.nome,
          telefone: b.fullPhone,
          imoviewCodigo: b.imoviewCodigo,
          equipe: b.equipe,
          ativo: true,
          observacoes: "Cadastrado via importação de equipe Rhema",
        },
      });
      console.log(`[BrokerContact] Criado: ${b.nome} (${b.fullPhone})`);
    }

    // 2. Cadastrar / Atualizar na tabela User para permitir Login
    // Login baseado em número de whatsapp DDD+Numero (e.g. 13991673717)
    // Email padrão interno: 13991673717@rhemaimoveis.com.br
    const userEmail = `${b.phoneDddNum}@rhemaimoveis.com.br`;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: b.phoneDddNum },
          { phone: b.fullPhone },
          { email: userEmail },
          ...(b.imoviewCodigo ? [{ imoviewCorretorCodigo: b.imoviewCodigo }] : []),
        ],
      },
    });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: b.nome,
          phone: b.phoneDddNum,
          email: existingUser.email || userEmail,
          password: hashedPassword,
          mustChangePassword: true,
          role: "CORRETOR",
          imoviewCorretorCodigo: b.imoviewCodigo || existingUser.imoviewCorretorCodigo,
          imoviewCorretorNome: b.nome,
          isActive: true,
        },
      });
      console.log(`[User] Atualizado login: ${b.phoneDddNum} (${b.nome})`);
    } else {
      await prisma.user.create({
        data: {
          name: b.nome,
          email: userEmail,
          phone: b.phoneDddNum,
          password: hashedPassword,
          role: "CORRETOR",
          mustChangePassword: true,
          imoviewCorretorCodigo: b.imoviewCodigo,
          imoviewCorretorNome: b.nome,
          isActive: true,
        },
      });
      console.log(`[User] Criado usuário de login: ${b.phoneDddNum} / Senha: ${defaultPassword}`);
    }
  }

  console.log("\nTodos os corretores foram cadastrados e vinculados com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
