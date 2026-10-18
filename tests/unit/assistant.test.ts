import { describe, expect, it, vi } from "vitest";
import type { AICompletionRequest, AIProvider } from "@/server/integrations/ai/types";

vi.mock("server-only", () => ({}));

const { isBriefReady, mergeBrief, missingFields, readBrief } = await import("@/server/assistant/brief");
const { buildSystemPrompt, InvalidModelOutputError, parseModelOutput, runTurn } = await import("@/server/assistant/turn");
const { createSimulatedProvider } = await import("@/server/integrations/ai/simulated");
const { getAiConfig, getAiStatus } = await import("@/server/integrations/ai/config");
const { getAiProvider } = await import("@/server/integrations/ai");

/** Proveedor de test: devuelve las salidas dadas en orden y guarda lo que recibió. */
function scripted(outputs: (string | { text: string; truncated: boolean })[]) {
  const requests: AICompletionRequest[] = [];
  const provider: AIProvider = {
    name: "test",
    model: "test",
    async complete(request) {
      requests.push(request);
      const next = outputs.shift() ?? "";
      const { text, truncated } = typeof next === "string" ? { text: next, truncated: false } : next;
      return { text, truncated, usage: { inputTokens: 10, outputTokens: 5 } };
    },
  };
  return { provider, requests };
}

const turnOptions = { artistName: "Esti", styles: ["Realismo"], brief: {}, history: [] };

describe("resumen (brief)", () => {
  it("lo que ya se sabe no se borra: el modelo solo completa o corrige", () => {
    const brief = mergeBrief({ idea: "Un tigre", bodyZone: "Antebrazo" }, { bodyZone: null, sizeLabel: "15 cm", idea: "  " });
    expect(brief).toEqual({ idea: "Un tigre", bodyZone: "Antebrazo", sizeLabel: "15 cm" });
    expect(mergeBrief(brief, { bodyZone: "Pantorrilla" }).bodyZone).toBe("Pantorrilla");
  });

  it("está listo con idea, zona y tamaño", () => {
    expect(isBriefReady({ idea: "Un tigre", bodyZone: "Antebrazo" })).toBe(false);
    expect(isBriefReady({ idea: "Un tigre", bodyZone: "Antebrazo", sizeLabel: "15 cm" })).toBe(true);
    expect(missingFields({ idea: "Un tigre" })).not.toContain("idea");
  });

  it("al leer de la base descarta solo los campos inválidos", () => {
    expect(readBrief({ idea: "Un tigre", colorMode: "fucsia", isCoverUp: "si", extra: 1 })).toEqual({ idea: "Un tigre" });
    expect(readBrief(null)).toEqual({});
  });
});

describe("salida del modelo", () => {
  it("acepta el JSON pedido, también dentro de un bloque de código", () => {
    expect(parseModelOutput('{"reply":"Hola","brief":{"idea":"Un tigre"}}')).toEqual({ reply: "Hola", brief: { idea: "Un tigre" } });
    expect(parseModelOutput('```json\n{"reply":"Hola"}\n```')).toEqual({ reply: "Hola", brief: {} });
  });

  it("rechaza texto suelto, campos con tipos incorrectos y respuestas vacías", () => {
    expect(parseModelOutput("Hola, ¿qué te querés tatuar?")).toBeNull();
    expect(parseModelOutput('{"reply":"Hola","brief":{"colorMode":"fucsia"}}')).toBeNull();
    expect(parseModelOutput('{"reply":"","brief":{}}')).toBeNull();
    expect(parseModelOutput('{"reply":"Hola", "brief": {')).toBeNull();
  });
});

describe("turno de conversación", () => {
  it("le pasa al modelo lo que ya sabe para que no lo vuelva a preguntar", () => {
    const prompt = buildSystemPrompt({ artistName: "Esti", styles: [], brief: { idea: "Un tigre", bodyZone: "Antebrazo" } });
    expect(prompt).toContain("- Idea: Un tigre");
    expect(prompt).toContain("- Zona del cuerpo: Antebrazo");
    expect(prompt).toMatch(/Falta: Tamaño/);
    expect(prompt).toContain("No vuelvas a preguntar por lo que ya está en el resumen");
  });

  it("une el resumen y decide en el servidor si está listo", async () => {
    const { provider } = scripted(['{"reply":"Genial","brief":{"sizeLabel":"15 cm","notes":"confirmame el turno"}}']);
    const result = await runTurn({ ...turnOptions, provider, brief: { idea: "Un tigre", bodyZone: "Antebrazo" }, userMessage: "15 cm" });
    expect(result).toMatchObject({ reply: "Genial", ready: true, usage: { inputTokens: 10, outputTokens: 5 } });
    expect(result.brief).toMatchObject({ idea: "Un tigre", bodyZone: "Antebrazo", sizeLabel: "15 cm" });
  });

  it("aunque el modelo diga que está todo, sin zona y tamaño no está listo", async () => {
    const { provider } = scripted(['{"reply":"¡Listo, ya podés enviar! Turno confirmado.","brief":{"idea":"Un tigre"}}']);
    expect((await runTurn({ ...turnOptions, provider, userMessage: "un tigre" })).ready).toBe(false);
  });

  it("reintenta una vez si la salida no valida o vino cortada, y después falla con el consumo", async () => {
    const retried = scripted([{ text: '{"reply":"Hola"', truncated: true }, '{"reply":"Hola","brief":{}}']);
    expect((await runTurn({ ...turnOptions, provider: retried.provider, userMessage: "hola" })).usage).toEqual({ inputTokens: 20, outputTokens: 10 });

    const broken = scripted(["no es json", "tampoco"]);
    const error = await runTurn({ ...turnOptions, provider: broken.provider, userMessage: "hola" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(InvalidModelOutputError);
    expect((error as InstanceType<typeof InvalidModelOutputError>).usage).toEqual({ inputTokens: 20, outputTokens: 10 });
  });

  it("la conversación que se manda empieza con la persona y no supera la ventana", async () => {
    const history = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? ("assistant" as const) : ("user" as const), content: `m${index}` }));
    const { provider, requests } = scripted(['{"reply":"Ok"}']);
    await runTurn({ ...turnOptions, provider, history, userMessage: "último" });
    const sent = requests[0].messages;
    expect(sent[0].role).toBe("user");
    expect(sent.length).toBeLessThanOrEqual(21);
    expect(sent.at(-1)).toEqual({ role: "user", content: "último" });
  });
});

describe("proveedor simulado (solo pruebas)", () => {
  it("solo se acepta con la variable que lo habilita", () => {
    expect(getAiConfig({ AI_PROVIDER: "simulated" }).status).toBe("invalid");
    expect(getAiProvider({ AI_PROVIDER: "simulated" })).toBeNull();
    const env = { AI_PROVIDER: "simulated", INKFLOW_ALLOW_SIMULATED_AI: "1" };
    expect(getAiConfig(env)).toMatchObject({ status: "configured", provider: "simulated", maxMessagesPerConversation: 30 });
    expect(getAiStatus(env)).toMatchObject({ simulated: true });
    expect(getAiStatus({ AI_API_KEY: "clave-falsa", AI_MODEL: "m" })).toMatchObject({ simulated: false });
  });

  it("anota idea, zona y tamaño en orden y marca sus respuestas como simuladas", async () => {
    const provider = createSimulatedProvider();
    let brief = {};
    const history: { role: "user" | "assistant"; content: string }[] = [];
    for (const message of ["Una golondrina", "Antebrazo", "10 cm"]) {
      const result = await runTurn({ ...turnOptions, provider, brief, history, userMessage: message });
      expect(result.reply).toMatch(/^\(Respuesta simulada\)/);
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
      history.push({ role: "user", content: message }, { role: "assistant", content: result.reply });
      brief = result.brief;
    }
    expect(brief).toEqual({ idea: "Una golondrina", bodyZone: "Antebrazo", sizeLabel: "10 cm" });
    expect(isBriefReady(brief)).toBe(true);
  });
});

describe("confirmación de la consulta", async () => {
  const { assistantRequestSchema } = await import("@/server/requests/schemas");
  const base = {
    name: "Ana",
    email: "ana@example.com",
    phone: "",
    instagramHandle: "",
    idea: "Una golondrina con una rosa",
    bodyZone: "Antebrazo",
    sizeLabel: "10 cm",
    style: "",
    colorMode: "color",
    isCoverUp: "no",
    details: "",
    confirmed: "on",
  };

  it("sin la confirmación tildada no pasa", () => {
    const result = assistantRequestSchema.safeParse({ ...base, confirmed: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["confirmed"]);
  });

  it("normaliza los campos opcionales y exige un contacto", () => {
    expect(assistantRequestSchema.parse(base)).toMatchObject({ style: null, colorMode: "color", isCoverUp: false, details: null, phone: null });
    expect(assistantRequestSchema.parse({ ...base, colorMode: "", isCoverUp: "yes" })).toMatchObject({ colorMode: null, isCoverUp: true });
    expect(assistantRequestSchema.safeParse({ ...base, colorMode: "fucsia" }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ ...base, email: "" }).success).toBe(false);
  });
});
