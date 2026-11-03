import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recomendado para GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Obtém a chave simétrica de 256 bits (32 bytes) derivada com SHA-256.
 */
function getDerivedKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "rhema-os-symmetric-encryption-default-salt-2026";

  return crypto.createHash("sha256").update(secret).digest();
}

export interface EncryptedPayload {
  _encrypted: true;
  algorithm: "aes-256-gcm";
  iv: string; // hex
  tag: string; // hex
  data: string; // hex
}

/**
 * Criptografa qualquer dado (objeto, string, buffer) usando AES-256-GCM autenticado.
 */
export function encryptSessionData(plain: any): EncryptedPayload {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const serialized = typeof plain === "string" ? plain : JSON.stringify(plain);
  const encrypted = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    _encrypted: true,
    algorithm: "aes-256-gcm",
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
  };
}

/**
 * Descriptografa com segurança o payload cifrado.
 * Se o dado não for cifrado (ex: registros legados anteriores), retorna o dado original de forma transparente.
 */
export function decryptSessionData(payload: any): any {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload._encrypted !== true ||
    !payload.iv ||
    !payload.tag ||
    !payload.data
  ) {
    return payload;
  }

  try {
    const key = getDerivedKey();
    const iv = Buffer.from(payload.iv, "hex");
    const tag = Buffer.from(payload.tag, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, "hex")),
      decipher.final(),
    ]).toString("utf8");

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (err: any) {
    throw new Error(`Falha na descriptografia AES-256-GCM dos dados de sessão: ${err.message}`);
  }
}

