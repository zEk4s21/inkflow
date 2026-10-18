import type { StatusTone } from "./request-status";

/** Estados de un turno. La migración de la Fase 3.2 replica esta lista en un CHECK de Postgres. */
export const APPOINTMENT_STATUSES = ["requested", "confirmed", "cancelled", "completed", "no_show"] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, { label: string; tone: StatusTone }> = {
  requested: { label: "A confirmar", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "success" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  completed: { label: "Realizado", tone: "success" },
  no_show: { label: "No vino", tone: "danger" },
};
