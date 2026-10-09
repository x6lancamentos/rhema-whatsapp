/**
 * Utilitários de Formatação de Telefones e JIDs do WhatsApp
 * Suporte a números brasileiros (DDI 55 com 8 ou 9 dígitos) e internacionais.
 */

export function isGroupJid(jid?: string | null): boolean {
  if (!jid) return false;
  return jid.endsWith("@g.us");
}

export function isLidJid(jid?: string | null): boolean {
  if (!jid) return false;
  return jid.endsWith("@lid");
}

/**
 * Remove sufixos do WhatsApp (@s.whatsapp.net, @c.us, etc.) e caracteres não numéricos
 */
export function getCleanPhone(raw?: string | null): string {
  if (!raw) return "";
  const withoutJid = raw.split("@")[0];
  return withoutJid.replace(/\D/g, "");
}

/**
 * Formata um telefone ou JID para o padrão brasileiro:
 * - Celular: (XX) 9XXXX-XXXX
 * - Fixo: (XX) XXXX-XXXX
 * Caso seja internacional, formata com +DDI ...
 */
export function formatPhone(raw?: string | null): string {
  if (!raw) return "";

  if (isGroupJid(raw)) {
    return "Grupo";
  }

  const digits = getCleanPhone(raw);
  if (!digits) return raw;

  // Número brasileiro com DDI 55 (ex: 5513981001766 -> 13 dígitos, ou 551341414362 -> 12 dígitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);

    if (rest.length === 9) {
      return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) {
      return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }

  // Número brasileiro sem DDI 55 (ex: 13981001766 ou 1341414362)
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  // 8 ou 9 dígitos sem DDD
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // Internacional
  if (digits.length >= 7) {
    return `+${digits}`;
  }

  return raw;
}

/**
 * Retorna nome de exibição amigável para chat:
 * Se tiver nome, usa o nome. Se for número de telefone, exibe formatado.
 */
export function formatContactName(name?: string | null, jid?: string | null): string {
  if (name && name.trim().length > 0 && !name.match(/^\+?\d{8,}$/)) {
    return name.trim();
  }

  if (jid) {
    if (isGroupJid(jid)) return "Grupo";
    return formatPhone(jid);
  }

  return "Contato";
}
