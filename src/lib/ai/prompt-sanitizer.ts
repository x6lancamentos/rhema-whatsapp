/**
 * RHEMA OS — Sanitizador de Entrada & Defesa contra Prompt Injection
 * 
 * Mitiga:
 * 1. Ataques de injeção de prompt e jailbreak via mensagens de leads/proprietários
 * 2. Caracteres Unicode invisíveis e de controle usados para bypass de filtros
 * 3. DDoS de janela de contexto através de textos gigantescos (token overflow)
 */

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Remove caracteres invisíveis, controles ASCII e neutraliza tentativas de fechamento de tags XML.
 */
export function sanitizeInputText(rawText: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  if (!rawText || typeof rawText !== "string") {
    return "";
  }

  // 1. Remove caracteres de controle ASCII (exceto tab \t, newline \n e carriage return \r)
  let clean = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Remove caracteres Unicode invisíveis (zero-width spaces, directional overrides, etc.)
  clean = clean.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u206F]/g, "");

  // 3. Normaliza espaços múltiplos mantendo quebras de linha
  clean = clean.replace(/[ \t]+/g, " ");

  // 4. Trunca para o limite máximo de segurança
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength) + "... [texto truncado por segurança]";
  }

  // 5. Neutraliza tentativas de quebra de delimitador XML
  clean = clean
    .replace(/<\/?MENSAGEM_EXTERNA_RECEBIDA_DO_CLIENTE>/gi, "[tag-delimitador-bloqueada]")
    .replace(/<system>|<\/system>/gi, "[tag-sistema-bloqueada]")
    .replace(/<assistant>|<\/assistant>/gi, "[tag-assistente-bloqueada]");

  return clean.trim();
}

/**
 * Envolve a mensagem higienizada em bloco XML delimitado para orientar a LLM
 * a tratá-la exclusivamente como conteúdo passivo de dados do usuário.
 */
export function wrapExternalUserMessage(rawText: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  const sanitized = sanitizeInputText(rawText, maxLength);
  return `<MENSAGEM_EXTERNA_RECEBIDA_DO_CLIENTE>\n${sanitized}\n</MENSAGEM_EXTERNA_RECEBIDA_DO_CLIENTE>`;
}

