import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type SdrAiTask = "LEAD_CHAT" | "OWNER_CHAT" | "EXTRACTION" | "STRATEGY" | "LEARNING";

export interface ModelRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelRouterOptions {
  task: SdrAiTask;
  messages: ModelRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ModelRouterResult {
  content: string;
  jsonParsed?: any;
  modelUsed: string;
  latencyMs: number;
}

// Modelos gratuitos ativos padrão por tarefa
const DEFAULT_TASK_MODELS: Record<SdrAiTask, string[]> = {
  LEAD_CHAT: [
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-super-vl:free",
  ],
  OWNER_CHAT: [
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-super-vl:free",
  ],
  EXTRACTION: [
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-super-vl:free",
  ],
  STRATEGY: [
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-super-vl:free",
  ],
  LEARNING: [
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "liquid/lfm-2.5-2.6b:free",
  ],
};

// Circuit Breaker em memória para modelos com erros consecutivos (15 min cooldown)
interface CircuitBreakerEntry {
  consecutiveFailures: number;
  backoffUntil: number;
}
const circuitBreakerMap = new Map<string, CircuitBreakerEntry>();

function isModelAvailable(model: string): boolean {
  const entry = circuitBreakerMap.get(model);
  if (!entry) return true;
  if (Date.now() > entry.backoffUntil) {
    circuitBreakerMap.delete(model);
    return true;
  }
  return false;
}

function recordModelSuccess(model: string) {
  circuitBreakerMap.delete(model);
}

function recordModelFailure(model: string) {
  const entry = circuitBreakerMap.get(model) || { consecutiveFailures: 0, backoffUntil: 0 };
  entry.consecutiveFailures += 1;
  if (entry.consecutiveFailures >= 3) {
    entry.backoffUntil = Date.now() + 15 * 60 * 1000; // 15 minutos de cooldown
    logger.warn("ModelRouter", `Circuit Breaker ativado para ${model} por 15 minutos após 3 falhas consecutivas.`);
  }
  circuitBreakerMap.set(model, entry);
}

/**
 * Extrai JSON de maneira resiliente, suportando respostas com tags markdown e campos reasoning
 */
export function extractJsonFromText(rawText: string): any {
  if (!rawText || typeof rawText !== "string") return null;

  // Remove blocos de raciocínio/pensamento se o modelo incluir <think>...</think>
  let trimmed = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 1. Bloco de código markdown ```json ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // 2. Extrai entre a primeira { e a última }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  // 3. Tentativa direta
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Roteador principal multi-modelos para o ecossistema SDR
 */
export async function callModelRouter(options: ModelRouterOptions): Promise<ModelRouterResult> {
  const { task, messages, temperature = 0.25, maxTokens = 2000, jsonMode = false } = options;

  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY não configurada no ambiente.");
  }

  // Obter lista ordenada de modelos para a tarefa
  const candidateModels = (DEFAULT_TASK_MODELS[task] || DEFAULT_TASK_MODELS.LEAD_CHAT).filter(isModelAvailable);

  let lastError: any = null;

  for (const model of candidateModels) {
    const startTime = Date.now();
    try {
      logger.info("ModelRouter", `[${task}] Chamando modelo gratuito: ${model}`);

      const bodyPayload: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (jsonMode) {
        bodyPayload.response_format = { type: "json_object" };
      }

      // Desativa overhead de reasoning para respostas ágeis e sem vazamento de pensamento
      if (task === "EXTRACTION" || task === "LEAD_CHAT" || task === "OWNER_CHAT") {
        bodyPayload.reasoning = { effort: "none" };
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://rhemaimoveis.com.br",
          "X-Title": "Rhema SDR Autonomous Engine",
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(18000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errText = await response.text();
        logger.warn("ModelRouter", `Falha no modelo ${model} (HTTP ${response.status}): ${errText.slice(0, 160)}`);
        recordModelFailure(model);

        // Registra estatística de falha no banco
        prisma.aiModelStat
          .create({
            data: {
              task,
              model,
              success: false,
              latencyMs,
              errorCode: `HTTP_${response.status}`,
            },
          })
          .catch(() => {});

        lastError = new Error(`HTTP ${response.status} de ${model}`);
        continue;
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const messageContent = (choice?.message?.content || choice?.message?.reasoning || "").trim();

      if (!messageContent) {
        logger.warn("ModelRouter", `Modelo ${model} retornou conteúdo vazio.`);
        recordModelFailure(model);
        continue;
      }

      let parsed: any = null;
      if (jsonMode) {
        parsed = extractJsonFromText(messageContent);
        if (!parsed) {
          logger.warn("ModelRouter", `Modelo ${model} retornou texto sem JSON válido. Tentando próximo modelo...`);
          recordModelFailure(model);
          prisma.aiModelStat
            .create({
              data: {
                task,
                model,
                success: false,
                jsonValid: false,
                latencyMs,
                errorCode: "INVALID_JSON",
              },
            })
            .catch(() => {});
          continue;
        }
      }

      recordModelSuccess(model);

      // Registra métrica de sucesso em background
      prisma.aiModelStat
        .create({
          data: {
            task,
            model,
            success: true,
            jsonValid: jsonMode ? true : null,
            latencyMs,
          },
        })
        .catch(() => {});

      logger.info("ModelRouter", `[${task}] Sucesso com ${model} em ${latencyMs}ms.`);

      return {
        content: messageContent,
        jsonParsed: parsed,
        modelUsed: model,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      logger.error("ModelRouter", `Erro ao chamar ${model}:`, err?.message || err);
      recordModelFailure(model);

      prisma.aiModelStat
        .create({
          data: {
            task,
            model,
            success: false,
            latencyMs,
            errorCode: err?.name || "TIMEOUT_OR_NETWORK",
          },
        })
        .catch(() => {});

      lastError = err;
    }
  }

  // Fallback de emergência caso nenhum OpenRouter responda: Groq Cloud se houver chave
  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  if (groqKey) {
    try {
      logger.info("ModelRouter", `[${task}] Tentando fallback de emergência na Groq Cloud (llama-3.3-70b-versatile)...`);
      const startTime = Date.now();
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature,
          messages,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const d = await res.json();
        const content = d.choices?.[0]?.message?.content || "";
        const parsed = jsonMode ? extractJsonFromText(content) : undefined;
        return {
          content,
          jsonParsed: parsed,
          modelUsed: "groq/llama-3.3-70b-versatile",
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (groqErr) {
      logger.error("ModelRouter", "Fallback da Groq também falhou:", groqErr);
    }
  }

  throw lastError || new Error(`Nenhum modelo gratuito respondeu para a tarefa ${task}.`);
}
