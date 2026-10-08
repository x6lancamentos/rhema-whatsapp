/**
 * Spintax and Dynamic Variables Utility
 * Handles nested spintax resolution, dynamic variable replacement,
 * automatic time-based greetings, and Brazilian phone sanitization.
 */

/**
 * Resolves spintax patterns like {Oi|Olá|E aí} including nested patterns {A|{B1|B2}|C}.
 */
export function resolveSpintax(text: string): string {
  if (!text) return "";

  const spintaxRegex = /\{([^{}]+)\}/g;
  let resolved = text;

  // Repeat until no more curly braces matches are found (supports nesting)
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  while (spintaxRegex.test(resolved) && iterations < MAX_ITERATIONS) {
    resolved = resolved.replace(spintaxRegex, (_, options) => {
      const choices = options.split("|");
      const randomIndex = Math.floor(Math.random() * choices.length);
      return choices[randomIndex];
    });
    iterations++;
  }

  return resolved;
}

/**
 * Returns dynamic greeting based on current hour in Brazil (BRT/UTC-3)
 */
export function getGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) {
    return "Bom dia";
  } else if (hours >= 12 && hours < 18) {
    return "Boa tarde";
  } else {
    return "Boa noite";
  }
}

/**
 * Extracts first name from full name
 */
export function getFirstName(fullName?: string): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  return parts[0] || "";
}

/**
 * Resolves dynamic template variables like {{nome}}, {{primeiro_nome}}, {{saudacao}}
 * as well as custom columns from uploaded spreadsheets (case-insensitive).
 */
export function resolveVariables(
  template: string,
  variables: Record<string, any> = {}
): string {
  if (!template) return "";

  // Normalize variable keys to lower-case for robust lookup
  const normalizedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      normalizedVars[key.toLowerCase().trim()] = String(value);
    }
  }

  const name =
    normalizedVars["nome"] ||
    normalizedVars["name"] ||
    normalizedVars["cliente"] ||
    "";
  const firstName = getFirstName(name);
  const phone =
    normalizedVars["telefone"] ||
    normalizedVars["celular"] ||
    normalizedVars["whatsapp"] ||
    normalizedVars["phone"] ||
    "";

  // Built-in standard variables
  const builtIns: Record<string, string> = {
    saudacao: getGreeting(),
    nome: name,
    primeiro_nome: firstName,
    primeironome: firstName,
    telefone: phone,
    celular: phone,
    data: new Date().toLocaleDateString("pt-BR"),
    hora: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  // Replace all {{variable}} occurrences
  return template.replace(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g, (match, rawKey) => {
    const key = rawKey.toLowerCase().trim();

    // 1. Check custom variables first
    if (normalizedVars[key] !== undefined) {
      return normalizedVars[key];
    }

    // 2. Check built-ins
    if (builtIns[key] !== undefined) {
      return builtIns[key];
    }

    // 3. If variable not found, leave it or return empty string?
    // Leaving it as-is allows user to spot missing fields or custom tags
    return match;
  });
}

/**
 * Full message pipeline: Resolves variables first, then resolves Spintax.
 */
export function processPersonalizedMessage(
  template: string,
  variables: Record<string, any> = {}
): string {
  const withVariables = resolveVariables(template, variables);
  return resolveSpintax(withVariables);
}

/**
 * Extracts list of variable names used in a message (e.g. ['nome', 'bairro', 'saudacao'])
 */
export function extractVariableNames(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g);
  if (!matches) return [];
  const set = new Set<string>();
  for (const m of matches) {
    const key = m.replace(/\{\{\s*|\s*\}\}/g, "").toLowerCase().trim();
    set.add(key);
  }
  return Array.from(set);
}

/**
 * Sanitizes phone number:
 * - Removes non-digit characters
 * - Adds Brazil DDI (55) if 10 or 11 digits
 * - Formats to JID if needed
 */
export function sanitizePhoneNumber(
  rawPhone: string,
  defaultDdi: string = "55"
): { phone: string; jid: string; isValid: boolean } {
  if (!rawPhone) return { phone: "", jid: "", isValid: false };

  // Remove all non-digits
  let digits = String(rawPhone).replace(/\D/g, "");

  // If Brazilian standard 10 (DDD + 8 digits) or 11 (DDD + 9 digits), prepend 55
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith(defaultDdi)) {
    digits = defaultDdi + digits;
  }

  // Basic validity check: international numbers typically 10 to 15 digits
  const isValid = digits.length >= 10 && digits.length <= 15;
  const jid = `${digits}@s.whatsapp.net`;

  return { phone: digits, jid, isValid };
}
