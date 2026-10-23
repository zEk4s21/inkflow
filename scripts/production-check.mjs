// Reglas del chequeo previo a producción (lo usa scripts/check-production.mjs y lo prueban los tests).
// Nunca devuelve valores: solo nombres de variables y qué pasa con ellas.

const TURNSTILE_TEST_KEY = /^[123]x0{20,}/;
const SECRET_LOOKING = /^(sb_secret_|sk-ant-|re_)/;
// Igual que en src/server/integrations/email/config.ts.
const FROM_PATTERN = /^(?:[^<>\r\n]{1,80} <[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

function value(env, name) {
  const raw = env[name];
  return typeof raw === "string" ? raw.trim() : "";
}

function publicHttpsUrl(raw) {
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.hostname.endsWith(".localhost");
    return url.protocol === "https:" && !local;
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ errors: string[]; warnings: string[] }}
 *   errors: con esto no se puede salir a producción. warnings: anda, pero con algo apagado.
 */
export function checkProductionEnv(env) {
  const errors = [];
  const warnings = [];

  // Supabase y la URL del sitio.
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
    if (!value(env, name)) errors.push(`${name}: falta.`);
    else if (!publicHttpsUrl(value(env, name))) errors.push(`${name}: tiene que ser una URL https pública (no localhost).`);
  }
  if (!value(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: falta.");
  if (!value(env, "SUPABASE_SECRET_KEY")) errors.push("SUPABASE_SECRET_KEY: falta.");

  // Ningún secreto con prefijo NEXT_PUBLIC_: esas variables llegan al navegador.
  for (const [name, raw] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_") && SECRET_LOOKING.test(String(raw ?? "").trim())) {
      errors.push(`${name}: parece una clave secreta y las NEXT_PUBLIC_ son visibles en el navegador.`);
    }
  }

  // Modos de prueba: en el deploy de producción la app ya los ignora, pero no tienen que estar.
  if (value(env, "INKFLOW_ALLOW_NO_CAPTCHA")) errors.push("INKFLOW_ALLOW_NO_CAPTCHA: es solo para desarrollo; sacala.");
  if (value(env, "INKFLOW_ALLOW_SIMULATED_AI")) errors.push("INKFLOW_ALLOW_SIMULATED_AI: es solo para desarrollo; sacala.");
  if (value(env, "AI_PROVIDER") === "simulated") errors.push('AI_PROVIDER: "simulated" no es una IA; usá un proveedor real o dejalo vacío.');

  // Captcha: sin claves el formulario de consulta queda como no disponible.
  const siteKey = value(env, "NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  const secretKey = value(env, "TURNSTILE_SECRET_KEY");
  if (!siteKey || !secretKey) {
    errors.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY: faltan; sin captcha el formulario de consulta no se muestra.");
  } else if (TURNSTILE_TEST_KEY.test(siteKey) || TURNSTILE_TEST_KEY.test(secretKey)) {
    errors.push("Turnstile: son las claves de prueba de Cloudflare (aprueban a cualquiera); cargá las del sitio real.");
  }

  // Asistente: opcional.
  const aiKey = value(env, "AI_API_KEY");
  const aiModel = value(env, "AI_MODEL");
  if (!aiKey && !aiModel) {
    warnings.push("AI_API_KEY y AI_MODEL: vacías; el Ink Assistant se muestra como no disponible.");
  } else if (!aiKey || !aiModel) {
    errors.push(`${aiKey ? "AI_MODEL" : "AI_API_KEY"}: falta; con una sola de las dos el asistente no anda.`);
  } else if (!value(env, "AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE")) {
    warnings.push("AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE: vacía; el asistente no tiene tope mensual de gasto.");
  }

  // Emails: opcionales.
  const emailKey = value(env, "EMAIL_API_KEY");
  const emailFrom = value(env, "EMAIL_FROM");
  if (!emailKey && !emailFrom) {
    warnings.push("EMAIL_API_KEY y EMAIL_FROM: vacías; no sale ningún email (el panel lo muestra como no configurado).");
  } else if (!emailKey || !emailFrom) {
    errors.push(`${emailKey ? "EMAIL_FROM" : "EMAIL_API_KEY"}: falta; con una sola de las dos no sale ningún email.`);
  } else if (!FROM_PATTERN.test(emailFrom)) {
    errors.push('EMAIL_FROM: formato inválido; usá "Nombre <avisos@tu-dominio.com>" o una dirección sola.');
  }
  const provider = value(env, "EMAIL_PROVIDER");
  if (provider && provider !== "resend") errors.push(`EMAIL_PROVIDER: "${provider}" no está soportado (opciones: resend).`);

  return { errors, warnings };
}
