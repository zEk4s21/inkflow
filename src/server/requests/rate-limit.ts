import "server-only";
import { createHmac } from "node:crypto";

/** Envíos permitidos por hora: por persona (IP) y por estudio. */
export const RATE_LIMITS = { perSubmitter: 3, perWorkspace: 30 } as const;

/**
 * Identificador de quien envía, sin guardar la IP: HMAC con la clave secreta del servidor.
 * Sin la clave no se puede volver a la IP probando las 4.000 millones de combinaciones.
 */
export function submitterHash(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Primera IP de x-forwarded-for (la que agrega el proxy de la plataforma) o x-real-ip. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || null;
}
