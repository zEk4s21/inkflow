import { describe, expect, it, vi } from "vitest";
import { checkProductionEnv } from "../../scripts/production-check.mjs";

vi.mock("server-only", () => ({}));

const { getCaptchaConfig } = await import("@/server/requests/captcha");

// Valores inventados con la forma de los reales: nunca se usan contra ningún servicio.
const ready = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_falsa",
  SUPABASE_SECRET_KEY: "sb_secret_falsa",
  NEXT_PUBLIC_SITE_URL: "https://inkflow.example.com",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAfalsa",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAsecreta-falsa",
  EMAIL_PROVIDER: "resend",
  EMAIL_API_KEY: "clave-falsa",
  EMAIL_FROM: "INKFLOW <avisos@example.com>",
};

describe("chequeo previo a producción", () => {
  it("con todo cargado no marca nada", () => {
    expect(checkProductionEnv(ready)).toEqual({ errors: [], warnings: [] });
  });

  it("emails vacíos son un aviso, no un error", () => {
    const { EMAIL_API_KEY, EMAIL_FROM, ...rest } = ready;
    void [EMAIL_API_KEY, EMAIL_FROM];
    const result = checkProductionEnv(rest);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("rechaza localhost, http y el modo sin captcha", () => {
    const result = checkProductionEnv({
      ...ready,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://inkflow.example.com",
      INKFLOW_ALLOW_NO_CAPTCHA: "1",
    });
    expect(result.errors).toHaveLength(3);
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
    const result = checkProductionEnv({ ...ready, EMAIL_API_KEY: "", EMAIL_FROM: "INKFLOW <avisos@example.com>", TURNSTILE_SECRET_KEY: "" });
    expect(result.errors).toHaveLength(2);
    const text = [...result.errors, ...result.warnings].join(" ");
    for (const secret of [ready.SUPABASE_SECRET_KEY, ready.TURNSTILE_SECRET_KEY, ready.EMAIL_API_KEY]) expect(text).not.toContain(secret);
  });
});

describe("modo de prueba en el deploy de producción", () => {
  it("sin captcha solo fuera de producción", () => {
    expect(getCaptchaConfig({ INKFLOW_ALLOW_NO_CAPTCHA: "1" })).toEqual({ mode: "disabled" });
    expect(getCaptchaConfig({ INKFLOW_ALLOW_NO_CAPTCHA: "1", VERCEL_ENV: "preview" })).toEqual({ mode: "disabled" });
    expect(getCaptchaConfig({ INKFLOW_ALLOW_NO_CAPTCHA: "1", VERCEL_ENV: "production" })).toEqual({ mode: "missing" });
  });

});
