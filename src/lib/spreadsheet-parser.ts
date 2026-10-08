import * as XLSX from "xlsx";
import { sanitizePhoneNumber } from "./spintax";

export interface ParsedContactRow {
  originalPhone: string;
  phone: string;
  jid: string;
  name: string;
  isValid: boolean;
  variables: Record<string, any>;
}

export interface SpreadsheetParseResult {
  fileName: string;
  totalRows: number;
  validContacts: ParsedContactRow[];
  invalidRowsCount: number;
  duplicateCount: number;
  columns: string[];
  phoneColumn: string;
  nameColumn?: string;
}

const PHONE_HEADER_CANDIDATES = [
  "telefone",
  "celular",
  "whatsapp",
  "zap",
  "phone",
  "fone",
  "contato",
  "numero",
  "mobile",
  "tel",
];

const NAME_HEADER_CANDIDATES = [
  "nome",
  "name",
  "cliente",
  "lead",
  "contato",
  "comprador",
  "proprietario",
  "destinatario",
];

/**
 * Parses an Excel (.xlsx, .xls) or CSV file in the browser and extracts
 * contacts with automatic phone & variable detection.
 */
export async function parseSpreadsheet(file: File): Promise<SpreadsheetParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("A planilha está vazia.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new Error("Nenhum dado encontrado na primeira aba da planilha.");
  }

  // Extract all column headers from first row
  const columns = Object.keys(rawRows[0] || {}).map((c) => c.trim());

  // 1. Identify Phone column
  let phoneColumn = "";
  for (const candidate of PHONE_HEADER_CANDIDATES) {
    const match = columns.find((c) => c.toLowerCase().includes(candidate));
    if (match) {
      phoneColumn = match;
      break;
    }
  }

  // If no header matched, inspect cell data for digits
  if (!phoneColumn) {
    for (const col of columns) {
      const sample = String(rawRows[0]?.[col] || "").replace(/\D/g, "");
      if (sample.length >= 10 && sample.length <= 15) {
        phoneColumn = col;
        break;
      }
    }
  }

  if (!phoneColumn) {
    phoneColumn = columns[0] || "telefone";
  }

  // 2. Identify Name column
  let nameColumn: string | undefined = undefined;
  for (const candidate of NAME_HEADER_CANDIDATES) {
    const match = columns.find(
      (c) => c.toLowerCase().includes(candidate) && c !== phoneColumn
    );
    if (match) {
      nameColumn = match;
      break;
    }
  }

  // 3. Process each row
  const validContacts: ParsedContactRow[] = [];
  const seenJids = new Set<string>();
  let duplicateCount = 0;
  let invalidRowsCount = 0;

  for (const row of rawRows) {
    const rawPhone = String(row[phoneColumn] || "").trim();
    if (!rawPhone) {
      invalidRowsCount++;
      continue;
    }

    const sanitized = sanitizePhoneNumber(rawPhone);
    if (!sanitized.isValid) {
      invalidRowsCount++;
      continue;
    }

    if (seenJids.has(sanitized.jid)) {
      duplicateCount++;
      continue;
    }
    seenJids.add(sanitized.jid);

    const name = nameColumn ? String(row[nameColumn] || "").trim() : "";

    // Build custom variables dictionary (all other columns)
    const variables: Record<string, any> = {};
    for (const col of columns) {
      const val = row[col];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        variables[col] = String(val).trim();
      }
    }

    if (name) variables["nome"] = name;
    variables["telefone"] = sanitized.phone;

    validContacts.push({
      originalPhone: rawPhone,
      phone: sanitized.phone,
      jid: sanitized.jid,
      name,
      isValid: true,
      variables,
    });
  }

  return {
    fileName: file.name,
    totalRows: rawRows.length,
    validContacts,
    invalidRowsCount,
    duplicateCount,
    columns,
    phoneColumn,
    nameColumn,
  };
}
