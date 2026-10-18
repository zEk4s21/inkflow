import "server-only";
import { createAnthropicProvider } from "./anthropic";
import { getAiConfig } from "./config";
import type { AIProvider } from "./types";

export { getAiStatus, type AIStatus } from "./config";
export { AIProviderError, type AIMessage, type AIProvider } from "./types";

/** El proveedor configurado, o null si falta o está mal la configuración. */
export function getAiProvider(env?: Record<string, string | undefined>): AIProvider | null {
  const config = getAiConfig(env);
  if (config.status !== "configured") return null;
  switch (config.provider) {
    case "anthropic":
      return createAnthropicProvider({ apiKey: config.apiKey, model: config.model });
  }
}
