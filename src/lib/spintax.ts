/**
 * Spintax and Dynamic Variables Utility
 * Handles nested spintax resolution, dynamic variable replacement,
 * automatic time-based greetings, and Brazilian phone sanitization.
 */

/**
 * Normalizes a variable key:
 * - lowercased
 * - accents removed (á -> a)
 * - spaces, dashes and non-alphanumerics converted to underscores
 * e.g. "Código do Imóvel" -> "codigo_do_imovel"
 */
export function normalizeVarKey(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Resolves spintax patterns like {Oi|Olá|E aí} including nested patterns {A|{B1|B2}|C}.
 * IMPORTANT: ONLY patterns containing at least one '|' are treated as Spintax.
 * Single braces without '|' (like {nome_proprietario}) are preserved for variables!
 */
export function resolveSpintax(text: string): string {
  if (!text) return "";

  const spintaxRegex = /\{([^{}]+)\}/g;
  let resolved = text;

  // Repeat until no more curly braces matches are found (supports nesting)
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  while (spintaxRegex.test(resolved) && iterations < MAX_ITERATIONS) {
    resolved = resolved.replace(spintaxRegex, (fullMatch, options) => {
      // Must contain a pipe '|' to be valid Spintax
      if (!options.includes("|")) {
        return fullMatch;
      }
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
 * Resolves dynamic template variables supporting BOTH {{variavel}} and {variavel}
 * (case-insensitive, accent-insensitive, space/underscore agnostic).
 */
export function resolveVariables(
  template: string,
  variables: Record<string, any> = {}
): string {
  if (!template) return "";

  // Normalize variable map: store multiple indexed keys for foolproof matching
  const normalizedVars: Record<string, string> = {};

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      const strVal = String(value).trim();
      normalizedVars[key] = strVal;
      normalizedVars[key.toLowerCase().trim()] = strVal;

      const normKey = normalizeVarKey(key);
      normalizedVars[normKey] = strVal;
      normalizedVars[normKey.replace(/_/g, "")] = strVal;

      // Also index stripped Portuguese prepositions (e.g. codigo_do_imovel -> codigo_imovel)
      const strippedKey = normKey.replace(/_(de|do|da|dos|das)_/g, "_");
      if (strippedKey !== normKey) {
        normalizedVars[strippedKey] = strVal;
        normalizedVars[strippedKey.replace(/_/g, "")] = strVal;
      }
    }
  }

  // 1. Resolve Name Aliases
  const name =
    normalizedVars["nome"] ||
    normalizedVars["nome_proprietario"] ||
    normalizedVars["nome_do_proprietario"] ||
    normalizedVars["proprietario"] ||
    normalizedVars["cliente"] ||
    normalizedVars["destinatario"] ||
    normalizedVars["name"] ||
    normalizedVars["contato"] ||
    "";

  const firstName = getFirstName(name);

  // 2. Resolve Phone Aliases
  const phone =
    normalizedVars["telefone"] ||
    normalizedVars["celular"] ||
    normalizedVars["whatsapp"] ||
    normalizedVars["phone"] ||
    "";

  // 3. Built-in standard variables & Real Estate Aliases
  const builtIns: Record<string, string> = {
    saudacao: getGreeting(),
    nome: name,
    nome_proprietario: name,
    nome_do_proprietario: name,
    proprietario: name,
    cliente: name,
    destinatario: name,
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

  // 4. Resolve Property Code Aliases
  const codVal =
    normalizedVars["codigo_imovel"] ||
    normalizedVars["codigo_do_imovel"] ||
    normalizedVars["cod_imovel"] ||
    normalizedVars["cod_do_imovel"] ||
    normalizedVars["codigo"] ||
    normalizedVars["cod"] ||
    normalizedVars["codigoimovel"] ||
    normalizedVars["ref"] ||
    normalizedVars["referencia"] ||
    normalizedVars["imovel"] ||
    "";
  if (codVal) {
    builtIns["codigo_imovel"] = codVal;
    builtIns["codigo_do_imovel"] = codVal;
    builtIns["codigo"] = codVal;
    builtIns["cod_imovel"] = codVal;
    builtIns["cod"] = codVal;
    builtIns["ref"] = codVal;
    builtIns["referencia"] = codVal;
  }

  // 5. Resolve Property Type Aliases
  const tipoVal =
    normalizedVars["tipo_imovel"] ||
    normalizedVars["tipo_de_imovel"] ||
    normalizedVars["tipo_do_imovel"] ||
    normalizedVars["tipo"] ||
    normalizedVars["tipoimovel"] ||
    normalizedVars["categoria"] ||
    "";
  if (tipoVal) {
    builtIns["tipo_imovel"] = tipoVal;
    builtIns["tipo_de_imovel"] = tipoVal;
    builtIns["tipo"] = tipoVal;
    builtIns["categoria"] = tipoVal;
  }

  // 6. Resolve Neighborhood Aliases
  const bairroVal =
    normalizedVars["bairro"] ||
    normalizedVars["bairro_imovel"] ||
    normalizedVars["bairro_do_imovel"] ||
    normalizedVars["bairroimovel"] ||
    normalizedVars["localizacao"] ||
    "";
  if (bairroVal) {
    builtIns["bairro"] = bairroVal;
    builtIns["bairro_imovel"] = bairroVal;
    builtIns["localizacao"] = bairroVal;
  }

  // 7. Resolve Price / Value Aliases
  const valorVal =
    normalizedVars["valor"] ||
    normalizedVars["preco"] ||
    normalizedVars["valor_venda"] ||
    normalizedVars["valor_do_imovel"] ||
    normalizedVars["valor_imovel"] ||
    normalizedVars["valorimovel"] ||
    "";
  if (valorVal) {
    builtIns["valor"] = valorVal;
    builtIns["preco"] = valorVal;
    builtIns["valor_venda"] = valorVal;
    builtIns["valor_imovel"] = valorVal;
  }

  // 8. Resolve Condo Fee Aliases
  const condoVal =
    normalizedVars["condominio"] ||
    normalizedVars["valor_condominio"] ||
    normalizedVars["valor_do_condominio"] ||
    normalizedVars["valordocondominio"] ||
    normalizedVars["valorcondominio"] ||
    normalizedVars["condo"] ||
    "";
  if (condoVal) {
    builtIns["condominio"] = condoVal;
    builtIns["valor_condominio"] = condoVal;
    builtIns["valor_do_condominio"] = condoVal;
  }

  // 9. Resolve IPTU Aliases
  const iptuVal =
    normalizedVars["iptu"] ||
    normalizedVars["valor_iptu"] ||
    normalizedVars["valor_do_iptu"] ||
    normalizedVars["valordoiptu"] ||
    normalizedVars["valoriptu"] ||
    "";
  if (iptuVal) {
    builtIns["iptu"] = iptuVal;
    builtIns["valor_iptu"] = iptuVal;
    builtIns["valor_do_iptu"] = iptuVal;
  }

  const lookupValue = (rawKey: string): string | null => {
    const key = normalizeVarKey(rawKey);
    const compactKey = key.replace(/_/g, "");
    const strippedKey = key.replace(/_(de|do|da|dos|das)_/g, "_");
    const strippedCompactKey = strippedKey.replace(/_/g, "");
    const lowerRaw = rawKey.toLowerCase().trim();

    // Check custom variables map first
    if (normalizedVars[key] !== undefined) return normalizedVars[key];
    if (normalizedVars[strippedKey] !== undefined) return normalizedVars[strippedKey];
    if (normalizedVars[compactKey] !== undefined) return normalizedVars[compactKey];
    if (normalizedVars[strippedCompactKey] !== undefined) return normalizedVars[strippedCompactKey];
    if (normalizedVars[lowerRaw] !== undefined) return normalizedVars[lowerRaw];
    if (normalizedVars[rawKey] !== undefined) return normalizedVars[rawKey];

    // Check built-in and real estate aliases
    if (builtIns[key] !== undefined) return builtIns[key];
    if (builtIns[strippedKey] !== undefined) return builtIns[strippedKey];
    if (builtIns[compactKey] !== undefined) return builtIns[compactKey];
    if (builtIns[strippedCompactKey] !== undefined) return builtIns[strippedCompactKey];
    if (builtIns[lowerRaw] !== undefined) return builtIns[lowerRaw];

    return null;
  };

  // Pass 1: Replace all {{variable}} occurrences (double curly braces)
  let result = template.replace(/\{\{\s*([a-zA-Z0-9_\-\.\s]+)\s*\}\}/g, (match, rawKey) => {
    const found = lookupValue(rawKey);
    return found !== null ? found : match;
  });

  // Pass 2: Replace {variable} occurrences (single curly braces that DO NOT contain pipes '|')
  result = result.replace(/\{([^{}|]+)\}/g, (match, rawKey) => {
    const trimmed = rawKey.trim();
    // Verify it looks like a variable identifier
    if (/^[a-zA-Z0-9_\-\.\s]+$/.test(trimmed)) {
      const found = lookupValue(trimmed);
      if (found !== null) {
        return found;
      }
    }
    return match;
  });

  return result;
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
 * Supports both {{var}} and {var}.
 */
export function extractVariableNames(text: string): string[] {
  if (!text) return [];
  const set = new Set<string>();

  // Double braces {{...}}
  const doubleMatches = text.match(/\{\{\s*([a-zA-Z0-9_\-\.\s]+)\s*\}\}/g);
  if (doubleMatches) {
    for (const m of doubleMatches) {
      const key = normalizeVarKey(m.replace(/\{\{\s*|\s*\}\}/g, ""));
      if (key) set.add(key);
    }
  }

  // Single braces {...} without pipes
  const singleMatches = text.match(/\{([^{}|]+)\}/g);
  if (singleMatches) {
    for (const m of singleMatches) {
      const inner = m.replace(/\{|\}/g, "").trim();
      if (/^[a-zA-Z0-9_\-\.\s]+$/.test(inner)) {
        const key = normalizeVarKey(inner);
        if (key) set.add(key);
      }
    }
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
