import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface RhemaOfficialBroker {
  nomeOficial: string;
  nomesConhecidos: string[];
  imoviewCodigo: string;
  telefone: string; // Formato E.164: 55...
  email?: string;
  equipe: string;
}

export const OFFICIAL_RHEMA_BROKERS: RhemaOfficialBroker[] = [
  {
    nomeOficial: "Elaine do Nascimento",
    nomesConhecidos: ["elaine do nascimento", "elaine nascimento", "elaine"],
    imoviewCodigo: "14",
    telefone: "5513976008877",
    email: "elaine@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Flávia Mara de Mattos",
    nomesConhecidos: [
      "flavia mara de mattos",
      "flávia mara de mattos",
      "flavia mattos",
      "flávia mattos",
      "flavia mara",
      "flávia mara",
      "flavia",
      "flávia",
    ],
    imoviewCodigo: "18",
    telefone: "5515974042000",
    email: "flavia@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Tatiana Gonçalves de Oliveira",
    nomesConhecidos: [
      "tatiana goncalves de oliveira",
      "tatiana gonçalves de oliveira",
      "tatiana oliveira",
      "tatiana goncalves",
      "tatiana",
      "tati",
    ],
    imoviewCodigo: "13",
    telefone: "5513981854677",
    email: "tatiana@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Andressa Larocca Orlandi Pereira",
    nomesConhecidos: [
      "andressa larocca orlandi pereira",
      "andressa larocca",
      "andressa orlandi",
      "andressa pereira",
      "andressa",
    ],
    imoviewCodigo: "21",
    telefone: "5513981512755",
    email: "andressa@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Leniára R. M. Araújo",
    nomesConhecidos: [
      "leniara r. m. araujo",
      "leniára r. m. araújo",
      "leniara araujo",
      "leniára araújo",
      "leniara",
      "leniára",
    ],
    imoviewCodigo: "12",
    telefone: "5513996461664",
    email: "leniara@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Ulisses Dias Vieira",
    nomesConhecidos: [
      "ulisses dias vieira",
      "ulisses vieira",
      "ulisses dias",
      "ulisses",
    ],
    imoviewCodigo: "25",
    telefone: "5513988181515",
    email: "ulisses@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
  {
    nomeOficial: "Kaylane Assumpção",
    nomesConhecidos: [
      "kaylane assumpcao",
      "kaylane assumpção",
      "kaylane",
    ],
    imoviewCodigo: "16",
    telefone: "5513992123879",
    email: "kaylane@rhemaimobiliaria.com.br",
    equipe: "Vendas",
  },
];

function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve o telefone de WhatsApp de um corretor da Rhema com tolerância a acentos,
 * nomes abreviados, primeiro nome ou código Imoview.
 */
export function lookupBrokerPhone(corretorNome?: string, corretorCodigo?: string): string {
  const codStr = corretorCodigo ? String(corretorCodigo).trim() : "";

  // 1. Busca por código Imoview exato
  if (codStr) {
    const byCode = OFFICIAL_RHEMA_BROKERS.find((b) => b.imoviewCodigo === codStr);
    if (byCode) return byCode.telefone;
  }

  if (!corretorNome) return "";
  const normInput = normalizeName(corretorNome);
  if (!normInput) return "";

  // 2. Busca por match exato ou substring em nomes conhecidos
  for (const b of OFFICIAL_RHEMA_BROKERS) {
    for (const alias of b.nomesConhecidos) {
      const normAlias = normalizeName(alias);
      if (normInput === normAlias) return b.telefone;
      if (normInput.includes(normAlias) || normAlias.includes(normInput)) {
        return b.telefone;
      }
    }
  }

  // 3. Busca por primeiro nome (ex: "Elaine" em "Elaine do Nascimento")
  const firstName = normInput.split(" ")[0];
  if (firstName.length >= 3) {
    for (const b of OFFICIAL_RHEMA_BROKERS) {
      for (const alias of b.nomesConhecidos) {
        const aliasFirst = normalizeName(alias).split(" ")[0];
        if (firstName === aliasFirst) return b.telefone;
      }
    }
  }

  return "";
}

/**
 * Garante que todos os 10 corretores oficiais da Rhema existam na tabela `BrokerContact`.
 * Se já existirem, atualiza os dados para o padrão oficial mais recente.
 */
export async function seedOfficialBrokers() {
  try {
    let seededCount = 0;
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
      } else {
        await prisma.brokerContact.create({
          data: {
            nome: b.nomeOficial,
            telefone: b.telefone,
            email: b.email,
            imoviewCodigo: b.imoviewCodigo,
            equipe: b.equipe,
            ativo: true,
            observacoes: "Corretor Oficial Rhema Imóveis (Sincronizado)",
          },
        });
        seededCount++;
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

    logger.info("RhemaBrokers", `Sincronização de corretores oficiais concluída. Novos cadastrados: ${seededCount}`);
    return true;
  } catch (err: any) {
    logger.error("RhemaBrokers", "Falha ao sincronizar corretores oficiais:", err);
    return false;
  }
}

