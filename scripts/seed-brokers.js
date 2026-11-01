const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const OFFICIAL_RHEMA_BROKERS = [
  {
    nomeOficial: "Elaine do Nascimento",
    imoviewCodigo: "14",
    telefone: "5513976008877",
    email: "elaine@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Flávia Mara de Mattos",
    imoviewCodigo: "18",
    telefone: "5515974042000",
    email: "flavia@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Tatiana Gonçalves de Oliveira",
    imoviewCodigo: "13",
    telefone: "5513981854677",
    email: "tatiana@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Andressa Larocca Orlandi Pereira",
    imoviewCodigo: "21",
    telefone: "5513981512755",
    email: "andressa@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Leniára R. M. Araújo",
    imoviewCodigo: "12",
    telefone: "5513996461664",
    email: "leniara@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Ulisses Dias Vieira",
    imoviewCodigo: "25",
    telefone: "5513988181515",
    email: "ulisses@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Kaylane Assumpção",
    imoviewCodigo: "16",
    telefone: "5513992123879",
    email: "kaylane@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
];

async function main() {
  console.log("🌱 Semeando corretores oficiais da Rhema Imóveis no banco...");
  let count = 0;
  for (const b of OFFICIAL_RHEMA_BROKERS) {
    const existing = await prisma.brokerContact.findFirst({
      where: {
        OR: [
          { imoviewCodigo: b.imoviewCodigo },
          { telefone: b.telefone },
          { nome: { contains: b.nomeOficial.split(" ")[0] } },
        ],
      },
    });

    if (existing) {
      await prisma.brokerContact.update({
        where: { id: existing.id },
        data: {
          nome: b.nomeOficial,
          telefone: b.telefone,
          email: b.email,
          imoviewCodigo: b.imoviewCodigo,
          equipe: b.equipe,
          ativo: true,
        },
      });
      console.log(`  ✓ Atualizado: ${b.nomeOficial} (${b.telefone})`);
    } else {
      await prisma.brokerContact.create({
        data: {
          nome: b.nomeOficial,
          telefone: b.telefone,
          email: b.email,
          imoviewCodigo: b.imoviewCodigo,
          equipe: b.equipe,
          ativo: true,
          observacoes: "Corretor Oficial Rhema Imóveis",
        },
      });
      console.log(`  + Criado: ${b.nomeOficial} (${b.telefone})`);
      count++;
    }
  }

  // Desativa explicitamente os corretores revogados pela diretoria (Roseli, Luana, André)
  await prisma.brokerContact.updateMany({
    where: {
      OR: [
        { nome: { contains: "Roseli" } },
        { nome: { contains: "Luana" } },
        { nome: { contains: "André" } },
        { nome: { contains: "Andre" } },
        { imoviewCodigo: { in: ["11", "17", "19"] } },
        { telefone: { in: ["5513974103368", "5513981404451", "5513996960556"] } },
      ],
    },
    data: { ativo: false },
  });

  await prisma.user.updateMany({
    where: {
      OR: [
        { name: { contains: "Roseli" } },
        { name: { contains: "Luana" } },
        { name: { contains: "André" } },
        { name: { contains: "Andre" } },
        { email: { contains: "roseli" } },
        { email: { contains: "luana" } },
        { email: { contains: "andre" } },
        { phone: { in: ["13974103368", "13981404451", "13996960556", "5513974103368", "5513981404451", "5513996960556"] } },
      ],
    },
    data: { isActive: false },
  });

  console.log(`✅ Concluído! Total ativos oficiais: ${OFFICIAL_RHEMA_BROKERS.length} (Revogados: Roseli, Luana, André desativados)`);
}

main()
  .catch((e) => {
    console.error("Erro no seed de corretores:", e);
  })
  .finally(() => prisma.$disconnect());

