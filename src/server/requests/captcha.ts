import "server-only";
import { isProductionDeploy } from "@/server/deploy";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type CaptchaConfig =
  | { mode: "turnstile"; siteKey: string; secretKey: string }
  /** Solo con INKFLOW_ALLOW_NO_CAPTCHA=1 (desarrollo y tests sin acceso a Cloudflare); nunca en producción. */
  | { mode: "disabled" }
  /** Faltan las claves: el formulario se muestra como no disponible. */
  | { mode: "missing" };

export function getCaptchaConfig(env: Record<string, string | undefined> = process.env): CaptchaConfig {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secretKey = env.TURNSTILE_SECRET_KEY;
  if (siteKey && secretKey) return { mode: "turnstile", siteKey, secretKey };
  if (env.INKFLOW_ALLOW_NO_CAPTCHA === "1" && !isProductionDeploy(env)) return { mode: "disabled" };
  return { mode: "missing" };
}

/** Verifica el token de Cloudflare Turnstile del lado del servidor. */
export async function verifyTurnstile(
  token: string,
  secretKey: string,
  ip: string | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetcher(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
