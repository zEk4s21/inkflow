/**
 * Estados de una solicitud de tatuaje. Es la fuente única: la migración de la Fase 2
 * replica esta lista en un CHECK de Postgres.
 */
export const REQUEST_STATUSES = [
  "new",
  "reviewing",
  "needs_info",
  "quoted",
  "accepted",
  "rejected",
  "completed",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type StatusTone = "accent" | "info" | "warning" | "success" | "danger" | "neutral";

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; tone: StatusTone }> = {
  new: { label: "Nueva", tone: "accent" },
  reviewing: { label: "En evaluación", tone: "info" },
  needs_info: { label: "Necesita información", tone: "warning" },
  quoted: { label: "Presupuestada", tone: "info" },
  accepted: { label: "Aceptada", tone: "success" },
  rejected: { label: "Rechazada", tone: "neutral" },
  completed: { label: "Finalizada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};
