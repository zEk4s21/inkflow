import type { StatusTone } from "./request-status";

/** Estados de un presupuesto. La migración de la Fase 5.1 replica esta lista en un CHECK de Postgres. */
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "withdrawn"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  sent: { label: "Enviado", tone: "info" },
  accepted: { label: "Aceptado", tone: "success" },
  rejected: { label: "Rechazado", tone: "danger" },
  withdrawn: { label: "Retirado", tone: "neutral" },
};
