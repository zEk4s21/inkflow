import { createHash, randomBytes } from "node:crypto";

/** 32 bytes al azar en base64url: 43 caracteres. */
export const CLIENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateClientToken() {
  return randomBytes(32).toString("base64url");
}

/** En la base se guarda solo esto: con el hash no se puede rearmar el link. */
export function hashClientToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function clientLinkPath(token: string) {
  return `/seguimiento/${token}`;
}
