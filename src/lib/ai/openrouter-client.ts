import { logger } from "@/lib/logger";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterCompletionOptions {
  apiKey: string;
  model?: string;
  fallbackModel?: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
}

export interface OpenRouterResponse {
  content: string;
  modelUsed: string;
  latencyMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_PRIMARY_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const DEFAULT_FALLBACK_MODEL = "nvidia/nemotron-3.5-lightning:free";

/**
 * Chamada robusta ao OpenRouter com suporte a fallback automático de modelos
 */
export async function callOpenRouter(options: OpenRouterCompletionOptions): Promise<OpenRouterResponse> {
  const {
    apiKey,
    model = DEFAULT_PRIMARY_MODEL,
    fallbackModel = DEFAULT_FALLBACK_MODEL,
    messages,
    temperature = 0.3,
    maxTokens = 3500,
    responseFormatJson = false,
  } = options;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Chave de API do OpenRouter não informada.");
  }

  const cleanKey = apiKey.trim();
  const modelsToTry = [model];
  if (fallbackModel && fallbackModel !== model) {
    modelsToTry.push(fallbackModel);
  }

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    const startTime = Date.now();
    try {
      logger.info("OpenRouter", `Iniciando requisição para modelo: ${currentModel}`);

      const bodyPayload: any = {
        model: currentModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (responseFormatJson) {
        bodyPayload.response_format = { type: "json_object" };
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
          "HTTP-Referer": "https://rhemaimoveis.com.br",
          "X-Title": "Rhema Imoveis WhatsApp AI Gateway",
        },
        body: JSON.stringify(bodyPayload),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(
          "OpenRouter",
          `Falha no modelo ${currentModel} (HTTP ${response.status}): ${errorText.slice(0, 300)}`
        );
        lastError = new Error(`OpenRouter (${currentModel}): ${response.status} - ${errorText}`);
        // Continua para o fallback se houver
        continue;
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      logger.debug("OpenRouter", `Raw Choice: ${JSON.stringify(choice)}`);
      const messageContent = choice?.message?.content || choice?.message?.reasoning || "";

      if (!messageContent) {
        logger.warn("OpenRouter", `Data completa retornada: ${JSON.stringify(data)}`);
        throw new Error("OpenRouter retornou resposta vazia.");
      }

      logger.info(
        "OpenRouter",
        `Sucesso com ${currentModel} em ${latencyMs}ms. Tokens: ${data.usage?.total_tokens || "N/A"}`
      );

      return {
        content: messageContent,
        modelUsed: currentModel,
        latencyMs,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (err: any) {
      lastError = err;
      logger.error("OpenRouter", `Erro na tentativa com modelo ${currentModel}:`, err);
    }
  }

  throw lastError || new Error("Falha ao comunicar com OpenRouter em todos os modelos.");
}

/**
 * Testa a conexão e latência de uma chave do OpenRouter
 */
export async function testOpenRouterConnection(apiKey: string, model: string = DEFAULT_PRIMARY_MODEL) {
  const result = await callOpenRouter({
    apiKey,
    model,
    fallbackModel: DEFAULT_FALLBACK_MODEL,
    messages: [
      {
        role: "user",
        content: "Olá! Responda apenas: Conexão bem sucedida.",
      },
    ],
    maxTokens: 50,
    temperature: 0.1,
  });

  return result;
}
