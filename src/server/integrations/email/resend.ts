import "server-only";
import type { EmailMessage, EmailSendResult } from "./types";

const API_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;

/** Resend por su API REST (POST /emails), con fetch y sin SDK. */
export async function sendWithResend(
  options: { apiKey: string; from: string; fetcher?: typeof fetch },
  message: EmailMessage,
): Promise<EmailSendResult> {
  const { apiKey, from, fetcher = fetch } = options;
  let response: Response;
  try {
    response = await fetcher(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        // Un reintento del mismo aviso no manda dos emails.
        ...(message.idempotencyKey ? { "idempotency-key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html, reply_to: message.replyTo }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { status: "failed", detail: "sin conexión con el proveedor" };
  }
  if (!response.ok) return { status: "failed", detail: `el proveedor respondió ${response.status}` };
  try {
    const body = (await response.json()) as { id?: unknown };
    return { status: "sent", detail: typeof body.id === "string" ? body.id.slice(0, 200) : null };
  } catch {
    return { status: "sent", detail: null };
  }
}
