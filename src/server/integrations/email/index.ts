import "server-only";
import { getEmailConfig } from "./config";
import { sendWithResend } from "./resend";
import type { EmailMessage, EmailSendResult } from "./types";

export { getEmailConfig, getEmailStatus, type EmailConfig, type EmailStatus } from "./config";
export type { EmailMessage, EmailSendResult } from "./types";

/** Manda un email con el proveedor configurado. Sin configuración no hace nada y lo dice. */
export async function sendEmail(message: EmailMessage, env?: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<EmailSendResult> {
  const config = getEmailConfig(env);
  if (config.status !== "configured") return { status: "skipped", detail: "email no configurado" };
  switch (config.provider) {
    case "resend":
      return sendWithResend({ apiKey: config.apiKey, from: config.from, fetcher }, message);
  }
}
