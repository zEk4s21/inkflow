export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  idempotencyKey?: string;
};

/** "skipped": no hay proveedor configurado y no se intentó mandar nada. */
export type EmailSendResult = { status: "sent" | "failed" | "skipped"; detail: string | null };
