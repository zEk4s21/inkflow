import "server-only";
import { AIProviderError, type AICompletion, type AICompletionRequest, type AIProvider } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const TIMEOUT_MS = 60_000;

type MessagesResponse = {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string | null;
};

function errorFor(status: number): AIProviderError {
  if (status === 401 || status === 403) return new AIProviderError("auth", "La clave de la IA no es válida.", status);
  if (status === 429) return new AIProviderError("rate_limit", "La IA está recibiendo demasiados pedidos.", status);
  if (status === 400 || status === 404 || status === 413) return new AIProviderError("bad_request", "La IA rechazó el pedido.", status);
  return new AIProviderError("unavailable", "La IA no está respondiendo.", status);
}

/** Claude por la Messages API, con fetch y sin SDK. */
export function createAnthropicProvider(options: { apiKey: string; model: string; fetcher?: typeof fetch }): AIProvider {
  const { apiKey, model, fetcher = fetch } = options;
  return {
    name: "anthropic",
    model,
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      let response: Response;
      try {
        response = await fetcher(API_URL, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": API_VERSION },
          body: JSON.stringify({ model, max_tokens: request.maxTokens, system: request.system, messages: request.messages }),
          signal: request.signal ?? AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new AIProviderError("unavailable", "No se pudo conectar con la IA.");
      }
      if (!response.ok) throw errorFor(response.status);

      let body: MessagesResponse;
      try {
        body = (await response.json()) as MessagesResponse;
      } catch {
        throw new AIProviderError("bad_response", "La IA devolvió una respuesta ilegible.");
      }
      const text = (body.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("");
      if (!text) throw new AIProviderError("bad_response", "La IA devolvió una respuesta vacía.");
      return {
        text,
        usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 },
        truncated: body.stop_reason === "max_tokens",
      };
    },
  };
}
