/**
 * Producción real: el deploy de producción en Vercel (VERCEL_ENV lo define Vercel; en los
 * previews vale "preview"). Ahí se ignoran los modos de prueba aunque alguien cargue sus
 * variables por error: sin captcha y la IA simulada.
 */
export function isProductionDeploy(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production";
}
