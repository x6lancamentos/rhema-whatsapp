import { logger } from "@/lib/logger";

export interface GroqTranscriptionOptions {
  /** Chave gratuita do Groq Cloud (gsk_...) ou process.env.GROQ_API_KEY */
  apiKey?: string;
  /** Buffer ou Base64 do arquivo de áudio (.ogg, .mp3, .wav, .m4a) */
  audioData: Buffer | string;
  /** Nome do arquivo com extensão para o multipart (padrão: audio.ogg) */
  fileName?: string;
  /** MimeType do áudio (padrão: audio/ogg) */
  mimeType?: string;
  /** Modelo Whisper no Groq (padrão: whisper-large-v3-turbo) */
  model?: "whisper-large-v3-turbo" | "whisper-large-v3";
}

export interface GroqTranscriptionResult {
  text: string;
  modelUsed: string;
  latencyMs: number;
}

const SANTOS_RHEMA_VOCAB_PROMPT =
  "Áudio de corretor de imóveis da Rhema Imóveis em Santos SP. " +
  "Bairros: Embaré, Aparecida, Ponta da Praia, Gonzaga, Boqueirão, Pompéia, José Menino, Marapé, Campo Grande, Encruzilhada. " +
  "Termos: Imoview, Placar Rhema, Rhema Premium, exclusividade, laudêmio, condomínio, IPTU, vaga demarcada, " +
  "corretores Tatiana, Flávia, Roseli, Leniára, Luana, Elaine, André, Kaylane, Andressa, gestor Brunno.";

/**
 * Transcreve áudio de WhatsApp (.ogg Opus / .mp3 / .m4a) em ~0.4s usando o tier GRATUITO da Groq Cloud.
 */
export async function transcribeAudioWithGroq(
  options: GroqTranscriptionOptions
): Promise<GroqTranscriptionResult> {
  const apiKey = (options.apiKey || process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "Chave GROQ_API_KEY não configurada. Crie uma chave gratuita em console.groq.com para transcrição Whisper."
    );
  }

  const fileName = options.fileName || "whatsapp-audio.ogg";
  const mimeType = options.mimeType || "audio/ogg";
  const primaryModel = options.model || "whisper-large-v3-turbo";
  const modelsToTry =
    primaryModel === "whisper-large-v3-turbo"
      ? ["whisper-large-v3-turbo", "whisper-large-v3"]
      : ["whisper-large-v3", "whisper-large-v3-turbo"];

  const buffer =
    typeof options.audioData === "string"
      ? Buffer.from(options.audioData.replace(/^data:audio\/[^;]+;base64,/, ""), "base64")
      : options.audioData;

  let lastError: unknown = null;

  for (const currentModel of modelsToTry) {
    const startTime = Date.now();
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      formData.append("file", blob, fileName);
      formData.append("model", currentModel);
      formData.append("language", "pt");
      formData.append("response_format", "json");
      formData.append("temperature", "0");
      formData.append("prompt", SANTOS_RHEMA_VOCAB_PROMPT);

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        logger.warn(
          "GroqWhisper",
          `Falha no modelo ${currentModel} (${response.status}): ${errText.slice(0, 250)}`
        );
        lastError = new Error(`Groq Whisper (${currentModel}): HTTP ${response.status} - ${errText}`);
        continue;
      }

      const data = (await response.json()) as { text?: string };
      const text = (data.text || "").trim();

      logger.info(
        "GroqWhisper",
        `Áudio transcrito com sucesso via ${currentModel} em ${latencyMs}ms (${text.length} chars)`
      );

      return {
        text,
        modelUsed: currentModel,
        latencyMs,
      };
    } catch (err) {
      lastError = err;
      logger.error("GroqWhisper", `Erro ao transcrever com ${currentModel}:`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Falha ao transcrever áudio na Groq Cloud.");
}

