import { describe, expect, it, vi } from "vitest";
import { checkProductionEnv } from "../../scripts/production-check.mjs";

vi.mock("server-only", () => ({}));

const { getCaptchaConfig } = await import("@/server/requests/captcha");
const { getAiConfig } = await import("@/server/integrations/ai/config");

// Valores inventados con la forma de los reales: nunca se usan contra ningún servicio.
const ready = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_falsa",
  SUPABASE_SECRET_KEY: "sb_secret_falsa",
  NEXT_PUBLIC_SITE_URL: "https://inkflow.example.com",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAfalsa",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAsecreta-falsa",
  AI_API_KEY: "clave-falsa",
  AI_MODEL: "modelo-de-prueba",
  AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE: "2000000",
  EMAIL_PROVIDER: "resend",
  EMAIL_API_KEY: "clave-falsa",
  EMAIL_FROM: "INKFLOW <avisos@example.com>",
};

describe("chequeo previo a producción", () => {
  it("con todo cargado no marca nada", () => {
    expect(checkProductionEnv(ready)).toEqual({ errors: [], warnings: [] });
  });

  it("IA y emails vacíos son avisos, no errores", () => {
    const { AI_API_KEY, AI_MODEL, EMAIL_API_KEY, EMAIL_FROM, ...rest } = ready;
    void [AI_API_KEY, AI_MODEL, EMAIL_API_KEY, EMAIL_FROM];
    const result = checkProductionEnv(rest);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it("rechaza localhost, http y los modos de prueba", () => {
    const result = checkProductionEnv({
      ...ready,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://inkflow.example.com",
      INKFLOW_ALLOW_NO_CAPTCHA: "1",
      INKFLOW_ALLOW_SIMULATED_AI: "1",
      AI_PROVIDER: "simulated",
    });
    expect(result.errors).toHaveLength(5);
  });

  it("rechaza las claves de prueba de Turnstile y secretos con NEXT_PUBLIC_", () => {
    const result = checkProductionEnv({
      ...ready,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_pegada-por-error",
    });
    expect(result.errors).toHaveLength(2);
    expect(result.errors.join(" ")).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("marca la mitad de una configuración y nunca muestra valores", () => {
    const result = checkProductionEnv({ ...ready, AI_MODEL: "", EMAIL_FROM: "sin formato", AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE: "" });
    expect(result.errors).toHaveLength(2);
    const text = [...result.errors, ...result.warnings].join(" ");
    for (const secret of [ready.SUPABASE_SECRET_KEY, ready.TURNSTILE_SECRET_KEY, ready.AI_API_KEY]) expect(text).not.toContain(secret);
  });
});

describe("modos de prueba en el deploy de producción", () => {
  it("sin captcha solo fuera de producción", () => {
    expect(getCaptchaConfig({ INKFLOW_ALLOW_NO_CAPTCHA: "1" })).toEqual({ mode: "disabled" });
    expect(getCaptchaConfig({ INKFLOW_ALLOW_NO_CAPTCHA: "1", VERCEL_ENV: "preview" })).toEqual({ mode: "disabled" });
    expect(getCaptchaConfig({ INKFLOW_ALLOW_NO_CAPTCHA: "1", VERCEL_ENV: "production" })).toEqual({ mode: "missing" });
  });

  it("la IA simulada no se acepta en producción", () => {
    const simulated = { AI_PROVIDER: "simulated", INKFLOW_ALLOW_SIMULATED_AI: "1" };
    expect(getAiConfig(simulated).status).toBe("configured");
    expect(getAiConfig({ ...simulated, VERCEL_ENV: "production" }).status).toBe("invalid");
  });
});
