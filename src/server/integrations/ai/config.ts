import "server-only";
import { z } from "zod";

/** Proveedores con adaptador. Sumar uno es escribir su adaptador y agregarlo acá. */
export const AI_PROVIDERS = ["anthropic"] as const;
/**
 * "simulated" no es una IA: respuestas fijas para ver y probar la conversación sin clave.
 * Solo se acepta con INKFLOW_ALLOW_SIMULATED_AI=1, que nunca va en producción.
 */
export type AIProviderName = (typeof AI_PROVIDERS)[number] | "simulated";

export const AI_PROVIDER_LABELS: Record<AIProviderName, string> = {
  anthropic: "Anthropic (Claude)",
  simulated: "Simulado (solo pruebas, no es una IA)",
};

const positiveInt = (fallback: number | null) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value.trim() === "" ? fallback : Number(value)))
    .pipe(z.number().int().positive().nullable());

const limitsSchema = z.object({
  AI_MAX_MESSAGES_PER_CONVERSATION: positiveInt(30),
  AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE: positiveInt(null),
});

export type AIConfig =
  | {
      status: "configured";
      provider: AIProviderName;
      model: string;
      apiKey: string;
      maxMessagesPerConversation: number;
      /** null = sin tope mensual (se avisa en el panel). */
      monthlyTokenBudget: number | null;
    }
  /** Faltan variables: el asistente se muestra como no disponible. */
  | { status: "missing"; missing: string[] }
  /** Hay variables pero con valores que no sirven. */
  | { status: "invalid"; problems: string[] };

/** Lee la configuración de IA de las variables de entorno. Solo servidor: la clave nunca sale de acá. */
export function getAiConfig(env: Record<string, string | undefined> = process.env): AIConfig {
  const provider = env.AI_PROVIDER?.trim() || "anthropic";
  if (provider === "simulated") return simulatedConfig(env);
  const apiKey = env.AI_API_KEY?.trim();
  const model = env.AI_MODEL?.trim();

  const missing = [!apiKey && "AI_API_KEY", !model && "AI_MODEL"].filter((name): name is string => Boolean(name));
  if (missing.length > 0) return { status: "missing", missing };

  const problems: string[] = [];
  if (!(AI_PROVIDERS as readonly string[]).includes(provider)) {
    problems.push(`AI_PROVIDER="${provider}" no está soportado (opciones: ${AI_PROVIDERS.join(", ")}).`);
  }
  const limits = limitsSchema.safeParse(env);
  if (!limits.success) {
    for (const issue of limits.error.issues) problems.push(`${issue.path.join(".")} tiene que ser un número entero positivo.`);
  }
  if (problems.length > 0 || !limits.success) return { status: "invalid", problems };

  return {
    status: "configured",
    provider: provider as AIProviderName,
    model: model!,
    apiKey: apiKey!,
    maxMessagesPerConversation: limits.data.AI_MAX_MESSAGES_PER_CONVERSATION!,
    monthlyTokenBudget: limits.data.AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE,
  };
}

function simulatedConfig(env: Record<string, string | undefined>): AIConfig {
  if (env.INKFLOW_ALLOW_SIMULATED_AI !== "1") {
    return { status: "invalid", problems: ['AI_PROVIDER="simulated" solo funciona con INKFLOW_ALLOW_SIMULATED_AI=1 (nunca en producción).'] };
  }
  const limits = limitsSchema.safeParse(env);
  if (!limits.success) return { status: "invalid", problems: ["Los límites de IA tienen que ser números enteros positivos."] };
  return {
    status: "configured",
    provider: "simulated",
    model: "respuestas fijas",
    apiKey: "",
    maxMessagesPerConversation: limits.data.AI_MAX_MESSAGES_PER_CONVERSATION!,
    monthlyTokenBudget: limits.data.AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE,
  };
}

/** Lo que se puede mostrar en el panel: nunca la clave. */
export type AIStatus =
  | { status: "configured"; providerLabel: string; simulated: boolean; model: string; maxMessagesPerConversation: number; monthlyTokenBudget: number | null }
  | { status: "missing"; missing: string[] }
  | { status: "invalid"; problems: string[] };

export function getAiStatus(env?: Record<string, string | undefined>): AIStatus {
  const config = getAiConfig(env);
  if (config.status !== "configured") return config;
  return {
    status: "configured",
    providerLabel: AI_PROVIDER_LABELS[config.provider],
    simulated: config.provider === "simulated",
    model: config.model,
    maxMessagesPerConversation: config.maxMessagesPerConversation,
    monthlyTokenBudget: config.monthlyTokenBudget,
  };
}
