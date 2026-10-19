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

/** Cómo ve el estado el cliente en su link privado: en primera persona, como habla el tatuador. */
export const REQUEST_CLIENT_STATUS: Record<RequestStatus, { label: string; description: string }> = {
  new: { label: "Recibida", description: "Llegó bien. La voy a leer y te escribo." },
  reviewing: { label: "En revisión", description: "La estoy mirando. Si necesito algo más, te escribo." },
  needs_info: { label: "Falta información", description: "Necesito algunos datos más: fijate si te escribí por mensaje." },
  quoted: { label: "Presupuesto enviado", description: "Te pasé el presupuesto. Respondeme por mensaje si querés avanzar." },
  accepted: { label: "Aceptada", description: "¡Vamos! Coordinamos el turno y la seña por mensaje." },
  rejected: { label: "No avanzó", description: "Esta vez no la voy a poder hacer. Gracias por escribirme." },
  completed: { label: "Terminada", description: "¡Gracias por confiar! Si tenés dudas con los cuidados, escribime." },
  cancelled: { label: "Cancelada", description: "Quedó cancelada. Si querés retomarla, escribime." },
};
