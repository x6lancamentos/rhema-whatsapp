import { logger } from "@/lib/logger";
import { callModelRouter } from "../model-router";

export interface ParsedSdrIntake {
  success: boolean;
  leadNome: string;
  leadPhone: string;
  leadJid: string;
  codigoImovel?: string;
  origem?: string;
  observacoes?: string;
  missingPhone?: boolean;
  messageToGroupIfInvalid?: string;
}

/**
 * Normaliza número de telefone para padrão E.164 brasileiro sem formatação (55 + DDD + 9 dígitos)
 */
export function normalizeBrPhone(rawPhone: string): { cleanDigits: string; jid: string; isValid: boolean } {
  let digits = (rawPhone || "").replace(/\D/g, "");

  // Se começou com 0 (ex: 013997401988), remove o 0 inicial
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Se não tem DDI 55 mas tem DDD (10 ou 11 dígitos), adiciona 55
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }

  // Validação: telefone celular BR com 55 tem 12 ou 13 dígitos
  const isValid = digits.length >= 12 && digits.length <= 13 && digits.startsWith("55");
  const jid = `${digits}@s.whatsapp.net`;

  return { cleanDigits: digits, jid, isValid };
}

/**
 * Extrai deterministicamente código do imóvel a partir de texto ou links
 */
export function extractPropertyCode(text: string): string | undefined {
  if (!text) return undefined;

  // 1. Link do site da Rhema: /imovel/detalhes/1234 ou /imovel/1234
  const linkMatch = text.match(/rhemaimoveis\.com\.br\/imovel\/(?:detalhes\/)?(\d+)/i);
  if (linkMatch && linkMatch[1]) return linkMatch[1];

  // 2. Padrões textuais explícitos: "imóvel 6430", "cód 6430", "ref 6430", "#6430"
  const tagMatch = text.match(/(?:im[oó]vel|c[oó]d(?:igo)?|ref(?:er[eê]ncia)?|ficha)\s*[:#\-]?\s*(\d{2,6})/i);
  if (tagMatch && tagMatch[1]) return tagMatch[1];

  const hashMatch = text.match(/#(\d{2,6})\b/);
  if (hashMatch && hashMatch[1]) return hashMatch[1];

  return undefined;
}

/**
 * Parser inteligente de mensagens de intake postadas pela Camila ou Gestor no grupo Rhema SDR
 */
export async function parseSdrIntakeMessage(text: string): Promise<ParsedSdrIntake> {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return {
      success: false,
      leadNome: "",
      leadPhone: "",
      leadJid: "",
      messageToGroupIfInvalid: "A mensagem recebida está vazia.",
    };
  }

  // 1. Regex de extração rápida de telefone
  const phoneRegex = /(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(?:9\s*)?(\d{4,5})[-.\s]?(\d{4})/g;
  const matches = [...trimmed.matchAll(phoneRegex)];

  let detectedPhone = "";
  for (const m of matches) {
    const rawMatch = m[0];
    const normalized = normalizeBrPhone(rawMatch);
    if (normalized.isValid) {
      detectedPhone = normalized.cleanDigits;
      break;
    }
  }

  const detectedCode = extractPropertyCode(trimmed);

  // Se ambos foram detectados de forma direta por regex simples e o texto tem linhas explícitas
  const nameLineMatch = trimmed.match(/(?:nome|cliente|lead)\s*[:#\-]\s*([A-Za-zÀ-ÿ\s]{2,40})/i);
  const originLineMatch = trimmed.match(/(?:origem|m[ií]dia|portal|canal)\s*[:#\-]\s*([A-Za-zÀ-ÿ0-9\s]{2,30})/i);
  const obsLineMatch = trimmed.match(/(?:obs|observa[cç][aã]o|detalhes|nota)\s*[:#\-]\s*([\s\S]+)/i);

  if (detectedPhone && nameLineMatch && detectedCode) {
    const leadNome = nameLineMatch[1].trim();
    const { jid } = normalizeBrPhone(detectedPhone);
    return {
      success: true,
      leadNome,
      leadPhone: detectedPhone,
      leadJid: jid,
      codigoImovel: detectedCode,
      origem: originLineMatch ? originLineMatch[1].trim() : "Portal / Campanha",
      observacoes: obsLineMatch ? obsLineMatch[1].trim() : undefined,
    };
  }

  // 2. Extração via LLM (ModelRouter task EXTRACTION) para formatos variados e texto livre
  try {
    const systemPrompt = `Você é um extrator de dados de leads imobiliários da Rhema Imóveis.
Analise a mensagem postada pela recepção/Camila e extraia os campos no formato JSON:
{
  "leadNome": "Nome do cliente ou 'Cliente' caso não informado",
  "leadPhone": "Número de telefone completo apenas com dígitos (incluindo DDD, ex: 13997401988)",
  "codigoImovel": "Código numérico do imóvel de interesse (ex: 6430) ou null",
  "origem": "ZAP, VivaReal, OLX, Chaves na Mão, Instagram, Facebook, Site, Indicação, etc.",
  "observacoes": "Qualquer detalhe adicional informado sobre o cliente, pergunta feita ou preferência"
}`;

    const result = await callModelRouter({
      task: "EXTRACTION",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: trimmed },
      ],
      jsonMode: true,
    });

    const parsed = result.jsonParsed || {};

    const rawPhone = parsed.leadPhone || detectedPhone;
    if (!rawPhone) {
      return {
        success: false,
        leadNome: parsed.leadNome || "Cliente",
        leadPhone: "",
        leadJid: "",
        missingPhone: true,
        messageToGroupIfInvalid: "⚠️ *Atenção:* Não consegui identificar o telefone do lead nesta mensagem. Por favor, envie o telefone com DDD para que o Agente SDR possa iniciar o contato! 🙏",
      };
    }

    const { cleanDigits, jid, isValid } = normalizeBrPhone(rawPhone);
    if (!isValid) {
      return {
        success: false,
        leadNome: parsed.leadNome || "Cliente",
        leadPhone: cleanDigits,
        leadJid: jid,
        missingPhone: true,
        messageToGroupIfInvalid: `⚠️ *Telefone inválido (${rawPhone}):* O número precisa ter DDD + 9 dígitos (ex: 13997401988).`,
      };
    }

    return {
      success: true,
      leadNome: parsed.leadNome || "Cliente",
      leadPhone: cleanDigits,
      leadJid: jid,
      codigoImovel: parsed.codigoImovel ? String(parsed.codigoImovel) : (detectedCode || undefined),
      origem: parsed.origem || "Portal / WhatsApp",
      observacoes: parsed.observacoes || undefined,
    };
  } catch (err: any) {
    logger.error("SdrParser", "Erro na extração LLM do intake:", err);

    if (detectedPhone) {
      const { jid } = normalizeBrPhone(detectedPhone);
      return {
        success: true,
        leadNome: "Cliente",
        leadPhone: detectedPhone,
        leadJid: jid,
        codigoImovel: detectedCode,
        origem: "WhatsApp",
        observacoes: trimmed,
      };
    }

    return {
      success: false,
      leadNome: "Cliente",
      leadPhone: "",
      leadJid: "",
      missingPhone: true,
      messageToGroupIfInvalid: "⚠️ Não foi possível identificar o telefone do lead. Por favor, especifique o número de telefone.",
    };
  }
}

