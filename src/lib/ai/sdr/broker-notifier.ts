import { logger } from "@/lib/logger";
import { waManager } from "@/modules/whatsapp/manager";
import { getGestorSession } from "@/lib/rhema-session";

const PERSONALIDADE_CORRETORES: Record<string, string> = {
  "andre": "didatico",
  "andre felipe": "didatico",
  "tatiana": "energetico",
  "flavia": "objetivo",
  "leniara": "curto",
  "elaine": "estruturado",
  "kaylane": "empatico",
  "andressa": "dinamico",
  "ulisses": "consultivo",
  "georjana": "organizado",
};

function formatBrokerToneOpening(nome: string): string {
  const n = (nome || "").toLowerCase();
  let estilo = "objetivo";
  for (const [k, v] of Object.entries(PERSONALIDADE_CORRETORES)) {
    if (n.includes(k)) {
      estilo = v;
      break;
    }
  }

  const primeiroNome = nome.split(" ")[0] || "Corretor(a)";

  switch (estilo) {
    case "didatico":
      return `Olá, ${primeiroNome}! 🙏 Passo a passo para consolidar o atendimento:`;
    case "energetico":
      return `Bora, ${primeiroNome}! 🦁🔥 Oportunidade pronta na sua mesa:`;
    case "curto":
      return `Olá, ${primeiroNome}. Lead qualificado pronto para visita:`;
    case "estruturado":
      return `Bom dia, ${primeiroNome}! 📋 Segue o dossiê estruturado para sua carteira:`;
    case "empatico":
      return `Olá, ${primeiroNome}! 🌱 Lead bem qualificado para você atender com segurança:`;
    case "dinamico":
      return `Pra cima, ${primeiroNome}! ⚡ Mais tração para acelerar sua meta:`;
    case "consultivo":
      return `Grande ${primeiroNome}! 🤝 Mais uma oportunidade sólida alinhada:`;
    case "organizado":
      return `Olá, ${primeiroNome}! ✨ Lead qualificado com dados completos para sua agenda:`;
    default:
      return `Olá, ${primeiroNome}! 🎯 Novo lead qualificado pela SDR da Rhema:`;
  }
}

export async function notifyBrokerAndGroup(params: {
  corretorNome: string;
  corretorTelefone: string;
  criterioDistribuicao: string;
  leadNome: string;
  leadPhone: string;
  codigoImovel?: string;
  bairro?: string;
  visitaDataHoraFormatada?: string;
  imoviewAtendimentoId?: number;
  temperatura?: string;
  dossieQualificacao: string;
  imovelIndisponivelAviso?: string;
  sessionId?: string;
}): Promise<boolean> {
  const {
    corretorNome,
    corretorTelefone,
    criterioDistribuicao,
    leadNome,
    leadPhone,
    codigoImovel,
    bairro,
    visitaDataHoraFormatada,
    imoviewAtendimentoId,
    temperatura = "QUENTE",
    dossieQualificacao,
    imovelIndisponivelAviso,
    sessionId = process.env.RHEMA_SDR_SESSION_ID || "5mhrx9",
  } = params;

  try {
    const instance = waManager.getInstance(sessionId);
    const sock = instance?.socket;
    if (!sock) {
      logger.warn("BrokerNotifier", `Sessão ${sessionId} não está pronta no waManager. Notificação em espera.`);
      return false;
    }

    const abertura = formatBrokerToneOpening(corretorNome);
    const cleanPhone = leadPhone.replace(/\D/g, "");
    const waLink = `https://wa.me/${cleanPhone}`;

    let textoCorretor =
`${abertura}

🎯 *NOVO LEAD QUALIFICADO — RHEMA SDR*
─────────────────────────────────────
👤 *Cliente:* ${leadNome}
📱 *WhatsApp:* ${leadPhone} (${waLink})
🔥 *Temperatura:* [${temperatura}]
📌 *Imoview CRM:* Atendimento #${imoviewAtendimentoId || "Em registro"}
⚡ *Critério:* ${criterioDistribuicao}

🏠 *Imóvel de Interesse:* Cód. ${codigoImovel || "Perfil Aberto"} (${bairro || "Santos"})
`;

    if (visitaDataHoraFormatada) {
      textoCorretor += `📅 *VISITA AGENDADA:* *${visitaDataHoraFormatada}*\n`;
    }

    if (imovelIndisponivelAviso) {
      textoCorretor += `⚠️ *ATENÇÃO AO HISTÓRICO:* ${imovelIndisponivelAviso}\n`;
    }

    textoCorretor +=
`\n📋 *DOSSIÊ DOS 4 PILARES:*
${dossieQualificacao}
─────────────────────────────────────
_Boa condução e bora fechar negócio! 💪_`;

    // 1. Enviar para o corretor se tiver telefone
    const cleanCorretorPhone = corretorTelefone.replace(/\D/g, "");
    if (cleanCorretorPhone.length >= 10) {
      const corretorJid = cleanCorretorPhone.startsWith("55")
        ? `${cleanCorretorPhone}@s.whatsapp.net`
        : `55${cleanCorretorPhone}@s.whatsapp.net`;

      try {
        await sock.sendMessage(corretorJid, { text: textoCorretor });
        logger.info("BrokerNotifier", `Notificação enviada com sucesso ao corretor ${corretorNome} (${corretorJid}).`);
      } catch (cErr) {
        logger.error("BrokerNotifier", `Erro ao notificar corretor ${corretorNome}:`, cErr);
      }
    }

    // 2. Enviar resumo executivo no Grupo Rhema SDR
    const groupJid = process.env.RHEMA_SDR_GROUP_JID || "120363431510652216@g.us";
    if (groupJid) {
      const textoGrupo =
`✅ *LEAD CONDUZIDO COM SUCESSO!* 🎯
─────────────────────────────────────
👤 *Lead:* ${leadNome} (${leadPhone})
🏠 *Imóvel:* #${codigoImovel || "N/A"} (${bairro || "Santos"})
${visitaDataHoraFormatada ? `📅 *Visita:* ${visitaDataHoraFormatada}\n` : ""}👤 *Corretor Destinado:* *${corretorNome}* (Critério: ${criterioDistribuicao})
📌 *CRM Imoview:* Atendimento #${imoviewAtendimentoId || "OK"} (Fase ${visitaDataHoraFormatada ? "8 - Agendamento" : "2 - Qualificado"})
─────────────────────────────────────`;

      try {
        await sock.sendMessage(groupJid, { text: textoGrupo });
        logger.info("BrokerNotifier", `Resumo executivo enviado no grupo Rhema SDR (${groupJid}).`);
      } catch (gErr) {
        logger.warn("BrokerNotifier", "Aviso ao enviar resumo no grupo SDR:", gErr);
      }
    }

    return true;
  } catch (err: any) {
    logger.error("BrokerNotifier", "Falha geral ao notificar corretor e grupo:", err);
    return false;
  }
}

