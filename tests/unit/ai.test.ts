import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getAiConfig, getAiStatus } = await import("@/server/integrations/ai/config");
const { createAnthropicProvider } = await import("@/server/integrations/ai/anthropic");
const { getAiProvider } = await import("@/server/integrations/ai");
const { AIProviderError } = await import("@/server/integrations/ai/types");

// Clave inventada para los tests: nunca se manda a ningún lado (fetch simulado).
const FAKE_KEY = "clave-falsa-de-test";
const configured = { AI_PROVIDER: "anthropic", AI_API_KEY: FAKE_KEY, AI_MODEL: "modelo-de-prueba" };

describe("configuración de IA", () => {
  it("sin clave ni modelo queda como no configurada y dice qué falta", () => {
    expect(getAiConfig({})).toEqual({ status: "missing", missing: ["AI_API_KEY", "AI_MODEL"] });
    expect(getAiConfig({ AI_API_KEY: FAKE_KEY, AI_MODEL: " " })).toEqual({ status: "missing", missing: ["AI_MODEL"] });
    expect(getAiProvider({})).toBeNull();
  });

  it("rechaza proveedores sin adaptador y límites que no son enteros positivos", () => {
    const result = getAiConfig({ ...configured, AI_PROVIDER: "otro", AI_MAX_MESSAGES_PER_CONVERSATION: "-3" });
    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && result.problems).toHaveLength(2);
  });

  it("usa Anthropic por defecto y 30 mensajes por conversación", () => {
    const result = getAiConfig({ AI_API_KEY: FAKE_KEY, AI_MODEL: "modelo-de-prueba" });
    expect(result).toMatchObject({ status: "configured", provider: "anthropic", maxMessagesPerConversation: 30, monthlyTokenBudget: null });
    expect(getAiProvider(configured)?.model).toBe("modelo-de-prueba");
  });

  it("el estado para el panel nunca incluye la clave", () => {
    const status = getAiStatus({ ...configured, AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE: "500000" });
    expect(status).toMatchObject({ status: "configured", providerLabel: "Anthropic (Claude)", monthlyTokenBudget: 500000 });
    expect(JSON.stringify(status)).not.toContain(FAKE_KEY);
  });
});

describe("adaptador de Anthropic (con fetch simulado)", () => {
  const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  const request = { system: "Sos un asistente.", messages: [{ role: "user" as const, content: "Hola" }], maxTokens: 200 };

  it("arma el pedido de la Messages API y lee el texto y el uso", async () => {
    const fetcher = reply(200, {
      content: [{ type: "text", text: "Hola, " }, { type: "text", text: "¿qué te querés tatuar?" }],
      usage: { input_tokens: 12, output_tokens: 8 },
      stop_reason: "end_turn",
    });
    const provider = createAnthropicProvider({ apiKey: FAKE_KEY, model: "modelo-de-prueba", fetcher });
    const result = await provider.complete(request);
    expect(result).toEqual({ text: "Hola, ¿qué te querés tatuar?", usage: { inputTokens: 12, outputTokens: 8 }, truncated: false });

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": FAKE_KEY, "anthropic-version": "2023-06-01" });
    expect(JSON.parse(String(init.body))).toEqual({ model: "modelo-de-prueba", max_tokens: 200, system: "Sos un asistente.", messages: request.messages });
  });

  it("marca la respuesta cortada por el tope de tokens", async () => {
    const fetcher = reply(200, { content: [{ type: "text", text: "Hola" }], stop_reason: "max_tokens" });
    const result = await createAnthropicProvider({ apiKey: FAKE_KEY, model: "m", fetcher }).complete(request);
    expect(result.truncated).toBe(true);
  });

  it("traduce los errores sin exponer la clave", async () => {
    for (const [status, kind] of [[401, "auth"], [429, "rate_limit"], [400, "bad_request"], [529, "unavailable"]] as const) {
      const provider = createAnthropicProvider({ apiKey: FAKE_KEY, model: "m", fetcher: reply(status, { error: {} }) });
      const error = await provider.complete(request).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AIProviderError);
      expect(error).toMatchObject({ kind, status });
      expect(String((error as Error).message)).not.toContain(FAKE_KEY);
    }
    const offline = vi.fn(async () => {
      throw new Error("sin red");
    });
    await expect(createAnthropicProvider({ apiKey: FAKE_KEY, model: "m", fetcher: offline }).complete(request)).rejects.toMatchObject({
      kind: "unavailable",
    });
    await expect(createAnthropicProvider({ apiKey: FAKE_KEY, model: "m", fetcher: reply(200, { content: [] }) }).complete(request)).rejects.toMatchObject({
      kind: "bad_response",
    });
  });
});
