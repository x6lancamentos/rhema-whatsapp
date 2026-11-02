import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { callModelRouter } from "../model-router";
import { waManager } from "@/modules/whatsapp/manager";

export async function evaluateAndRecordLeadLearning(sdrLeadId: string) {
  try {
    const lead = await prisma.sdrLead.findUnique({
      where: { id: sdrLeadId },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!lead) return;

    // Se já gerou insight para este lead, não repete
    const existing = await prisma.sdrLearningInsight.findFirst({
      where: { sdrLeadId },
    });
    if (existing) return;

    // Reúne histórico de diálogo
    const leadConv = lead.conversations.find((c) => c.role === "LEAD");
    const ownerConv = lead.conversations.find((c) => c.role === "OWNER");

    const leadTranscript = (leadConv?.messages || []).map((m) => `[${m.direction}]: ${m.content}`).join("\n");
    const ownerTranscript = (ownerConv?.messages || []).map((m) => `[${m.direction}]: ${m.content}`).join("\n");

    const promptUser =
`Analise o atendimento SDR abaixo e extraia um aprendizado prático de melhoria contínua comercial:
- Status Final: ${lead.status}
- Lead: ${lead.leadNome} (Origem: ${lead.origem || "Portal"})
- Temperatura: ${lead.temperatura}
- Imóvel Alvo: ${lead.codigoImovel || "N/A"}
- Status do Proprietário: ${lead.ownerStatus || "N/A"}

DIÁLOGO COM O CLIENTE:
${leadTranscript || "Nenhuma mensagem gravada"}

DIÁLOGO COM O PROPRIETÁRIO:
${ownerTranscript || "Nenhuma mensagem com proprietário"}

Gere uma avaliação no seguinte formato JSON:
{
  "teveSucesso": boolean,
  "tipoInsight": "OBJECAO" | "PADRAO_CONVERSAO" | "SUCESSO_VISITA" | "DESISTENCIA_PROPRIETARIO" | "SUGESTAO_FLUXO",
  "titulo": "Título curto de 1 linha (ex: Dúvida recorrente sobre vaga de garagem no Gonzaga)",
  "diagnostico": "2 a 3 linhas explicando o que funcionou ou o que travou na conversa",
  "sugestaoAcao": "Recomendação prática de como o SDR deve conduzir os próximos casos similares",
  "mereceNotificarGrupo": boolean
}`;

    const result = await callModelRouter({
      task: "LEARNING",
      messages: [
        {
          role: "system",
          content: "Você é o Analista de Auto-Evolução e Qualidade Comercial do Rhema OS. Seja cirúrgico, objetivo e focado em aumento de conversão.",
        },
        { role: "user", content: promptUser },
      ],
      jsonMode: true,
    });

    const parsed = result.jsonParsed;
    if (!parsed?.titulo) return;

    const insight = await prisma.sdrLearningInsight.create({
      data: {
        sdrLeadId: lead.id,
        tipo: parsed.tipoInsight || "SUGESTAO_FLUXO",
        titulo: parsed.titulo,
        diagnostico: parsed.diagnostico || "",
        sugestaoAcao: parsed.sugestaoAcao || "",
        notificadoGrupoSdr: false,
      },
    });

    logger.info("SdrLearner", `Insight de aprendizagem registrado para lead ${lead.leadNome}: "${insight.titulo}"`);

    // Se merecer notificação e o lead tiver desfecho relevante, publica no grupo Rhema SDR
    if (parsed.mereceNotificarGrupo) {
      await postSingleInsightToGroup(insight.id);
    }
  } catch (err: any) {
    logger.warn("SdrLearner", "Aviso na avaliação de aprendizagem do SDR:", err?.message || err);
  }
}

export async function postSingleInsightToGroup(insightId: string) {
  try {
    const insight = await prisma.sdrLearningInsight.findUnique({
      where: { id: insightId },
      include: { sdrLead: true },
    });
    if (!insight || insight.notificadoGrupoSdr) return;

    const groupJid = process.env.RHEMA_SDR_GROUP_JID || "120363431510652216@g.us";
    const sessionId = process.env.RHEMA_SDR_SESSION_ID || "5mhrx9";

    const instance = waManager.getInstance(sessionId);
    if (!instance?.socket) return;

    const texto =
`💡 *APRIMORAMENTO CONTÍNUO SDR — INSIGHT DE MERCADO* 📈
─────────────────────────────────────
🎯 *${insight.titulo}*

🔍 *Diagnóstico:*
${insight.diagnostico}

⚡ *Aprimoramento do Fluxo:*
${insight.sugestaoAcao}
─────────────────────────────────────
_Rhema OS — Auto-Evolução Contínua_`;

    await instance.socket.sendMessage(groupJid, { text: texto });
    await prisma.sdrLearningInsight.update({
      where: { id: insight.id },
      data: {
        notificadoGrupoSdr: true,
        notificadoEm: new Date(),
      },
    });

    logger.info("SdrLearner", `Insight #${insight.id} publicado no grupo Rhema SDR com sucesso.`);
  } catch (err) {
    logger.error("SdrLearner", `Erro ao postar insight no grupo:`, err);
  }
}

/**
 * Rotina periódica: varre insights pendentes relevantes e notifica o grupo
 */
export async function processPendingInsights() {
  try {
    const pending = await prisma.sdrLearningInsight.findMany({
      where: { notificadoGrupoSdr: false },
      take: 2,
      orderBy: { createdAt: "desc" },
    });

    for (const item of pending) {
      await postSingleInsightToGroup(item.id);
    }
  } catch (err) {
    logger.warn("SdrLearner", "Aviso ao processar insights pendentes:", err);
  }
}

