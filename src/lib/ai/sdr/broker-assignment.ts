import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface BrokerAssignmentResult {
  corretorNome: string;
  imoviewId: number;
  telefone: string;
  criterio: "FILA" | "MERITOCRACIA" | "CAPTADOR" | "TITULAR_EXISTENTE" | "ROUND_ROBIN";
  posicaoFila?: number;
}

const CORRETORES_IMOVIEW_MAP: Record<string, number> = {
  "andre": 24,
  "andre felipe": 24,
  "andressa": 21,
  "elaine": 14,
  "flavia": 20,
  "georjana": 28,
  "kaylane": 16,
  "leniara": 12,
  "tatiana": 13,
  "ulisses": 25,
  "brunno": 8,
  "ana maria": 6,
  "miguel": 5,
};

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function resolveImoviewBrokerId(nome: string): number {
  const n = norm(nome);
  for (const [key, id] of Object.entries(CORRETORES_IMOVIEW_MAP)) {
    if (n.includes(key)) return id;
  }
  return 8; // Fallback para Brunno (Gestor)
}

/**
 * Consulta a Fila de Rodízio viva no SQLite vendas_rhema.db e seleciona o próximo corretor
 */
export async function assignBrokerForLead(params: {
  leadNome: string;
  leadPhone: string;
  imovelCodigo?: string;
  captadorNome?: string;
  temperatura?: string;
  visitaDataHora?: Date;
}): Promise<BrokerAssignmentResult> {
  const { leadNome, leadPhone, imovelCodigo, captadorNome, temperatura, visitaDataHora } = params;

  const dbPath =
    process.env.VENDAS_SQLITE_PATH ||
    "C:\\Users\\brunn\\OneDrive\\Documentos\\Sistemas\\Rhema - Planilha de Vendas\\database\\vendas_rhema.db";

  // Se o SQLite estiver disponível no sistema
  if (fs.existsSync(dbPath)) {
    try {
      // @ts-ignore
      const sqliteModule = await import("node:sqlite");
      const DatabaseSync = sqliteModule.DatabaseSync;
      const db = new DatabaseSync(dbPath);

      // 1. Verificar se o Captador do imóvel está ativo e presente
      if (captadorNome) {
        const cNorm = norm(captadorNome);
        const captadorRow: any = db
          .prepare(
            `SELECT corretor_nome, status_presenca, ativo_equipe, participa_rodizio 
             FROM gather_avatares 
             WHERE ativo_equipe = 1 AND (LOWER(corretor_nome) LIKE ? OR LOWER(nome_exibicao) LIKE ?)`
          )
          .get(`%${cNorm}%`, `%${cNorm}%`);

        if (captadorRow && ["PRESENTE", "EM_ATENDIMENTO", "PAUSA_CAFE", "EM_VISITA"].includes(captadorRow.status_presenca)) {
          const imoviewId = resolveImoviewBrokerId(captadorRow.corretor_nome);
          const brokerContact = await prisma.brokerContact.findFirst({
            where: { nome: { contains: captadorRow.corretor_nome, mode: "insensitive" } },
          });

          // Registra na esteira para contabilizar
          registrarLeadAtendidoNoSqlite(db, leadNome, leadPhone, captadorRow.corretor_nome, imovelCodigo, "CAPTACAO");

          return {
            corretorNome: captadorRow.corretor_nome,
            imoviewId,
            telefone: brokerContact?.telefone || "",
            criterio: "CAPTADOR",
          };
        }
      }

      // 2. Calcular Fila FIFO em tempo real
      const avatares: any[] = db
        .prepare("SELECT * FROM gather_avatares WHERE ativo_equipe = 1 AND participa_rodizio = 1")
        .all();
      const filaRow: any = db
        .prepare("SELECT valor_json FROM gather_fila_estado WHERE chave = 'FILA_ORDEM_BASE'")
        .get();

      let ordemBase: string[] = [];
      try {
        ordemBase = filaRow ? JSON.parse(filaRow.valor_json) : [];
      } catch {}

      const elegiveis = avatares.map((a) => a.corretor_nome);
      const ordemInicial = [
        ...ordemBase.filter((n) => elegiveis.includes(n)),
        ...elegiveis.filter((n) => !ordemBase.includes(n)),
      ];

      const statusMap = new Map(avatares.map((a) => [a.corretor_nome, a.status_presenca]));
      const statusAtivos = new Set(["PRESENTE", "EM_ATENDIMENTO", "PAUSA_CAFE", "EM_VISITA"]);

      // Filtra apenas presentes no plantão
      let filaPresentes = ordemInicial.filter((n) => statusAtivos.has(statusMap.get(n)));
      if (filaPresentes.length === 0) {
        // Se ninguém marcou plantão, usa toda a ordem inicial de elegíveis
        filaPresentes = ordemInicial;
      }

      // Movimenta quem já atendeu lead ORDEM hoje para o fim da fila
      const hojeIso = new Date().toISOString().slice(0, 10);
      const leadsHoje: any[] = db
        .prepare("SELECT corretor_nome, tipo_lead FROM gather_leads_hoje WHERE data_iso = ? ORDER BY hora ASC, id ASC")
        .all(hojeIso);

      for (const l of leadsHoje) {
        if (l.tipo_lead === "ORDEM" && filaPresentes.includes(l.corretor_nome)) {
          filaPresentes = filaPresentes.filter((c) => c !== l.corretor_nome);
          filaPresentes.push(l.corretor_nome);
        }
      }

      // 3. Escolhe o corretor da vez
      let escolhidoNome = filaPresentes[0] || "Tatiana";
      let criterio: "FILA" | "MERITOCRACIA" = "FILA";

      // Se houver visita com data e hora estipuladas, verifica se o corretor já tem visita marcada (+/- 60 min)
      if (visitaDataHora && filaPresentes.length > 1) {
        const fromTime = new Date(visitaDataHora.getTime() - 60 * 60 * 1000);
        const toTime = new Date(visitaDataHora.getTime() + 60 * 60 * 1000);
        const conflito = await prisma.sdrLead.findFirst({
          where: {
            corretorNome: { contains: escolhidoNome, mode: "insensitive" },
            visitaDataHora: { gte: fromTime, lte: toTime },
            status: { in: ["VISIT_CONFIRMED", "HANDED_OFF"] },
          },
        });

        if (conflito) {
          logger.warn("BrokerAssignment", `Conflito de agenda para ${escolhidoNome} no horário da visita. Selecionando próximo da fila.`);
          escolhidoNome = filaPresentes[1] || escolhidoNome;
          criterio = "FILA";
        }
      }

      // Se for lead QUENTE, valida se o 1º da fila ou destaque da semana assume
      if (temperatura === "QUENTE" && filaPresentes.length > 1) {
        criterio = "MERITOCRACIA";
      }

      // Registra no SQLite para fazer a fila rodar
      registrarLeadAtendidoNoSqlite(db, leadNome, leadPhone, escolhidoNome, imovelCodigo, "ORDEM");

      const imoviewId = resolveImoviewBrokerId(escolhidoNome);
      const brokerContact = await prisma.brokerContact.findFirst({
        where: { nome: { contains: escolhidoNome, mode: "insensitive" } },
      });

      return {
        corretorNome: escolhidoNome,
        imoviewId,
        telefone: brokerContact?.telefone || "",
        criterio,
        posicaoFila: 1,
      };
    } catch (err) {
      logger.error("BrokerAssignment", "Erro ao consultar vendas_rhema.db:", err);
    }
  }

  // Fallback caso SQLite não esteja disponível: banco Postgres (BrokerContact ativo)
  const activeBrokers = await prisma.brokerContact.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });

  const fallback = activeBrokers[0] || { nome: "Tatiana", imoviewCodigo: "13", telefone: "" };
  return {
    corretorNome: fallback.nome,
    imoviewId: Number(fallback.imoviewCodigo) || 13,
    telefone: fallback.telefone || "",
    criterio: "ROUND_ROBIN",
  };
}

function registrarLeadAtendidoNoSqlite(
  db: any,
  leadNome: string,
  leadPhone: string,
  corretorNome: string,
  imovelCodigo?: string,
  tipoLead: "ORDEM" | "CAPTACAO" = "ORDEM"
) {
  try {
    const hoje = new Date();
    const dataIso = hoje.toISOString().slice(0, 10);
    const hora = `${String(hoje.getHours()).padStart(2, "0")}:${String(hoje.getMinutes()).padStart(2, "0")}`;

    db.prepare(
      `INSERT INTO gather_leads_hoje (data_iso, hora, cliente_nome, cliente_telefone, corretor_nome, alerta_duplicidade, tipo_lead, canal_midia, imovel_ref, imoview_id, notificado_wpp, criado_em)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?)`
    ).run(
      dataIso,
      hora,
      leadNome,
      leadPhone,
      corretorNome,
      tipoLead,
      "SDR IA",
      imovelCodigo || "N/A",
      resolveImoviewBrokerId(corretorNome),
      hoje.toISOString()
    );

    logger.info("BrokerAssignment", `Lead registrado no gather_leads_hoje para ${corretorNome} (fila avançou).`);
  } catch (err: any) {
    logger.warn("BrokerAssignment", "Aviso ao registrar lead no gather_leads_hoje:", err?.message || err);
  }
}
