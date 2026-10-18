import type { RegionalSettings } from "@/config/regional";
import { localDateOf } from "@/lib/availability";
import { formatDateTime } from "@/lib/format";
import type { AppointmentTimeInput } from "./schemas";

const time = (date: Date, regional: RegionalSettings) =>
  formatDateTime(date, regional, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Textos y valores de formulario de un turno, en la zona horaria del estudio. */
export function appointmentView(appointment: { start: Date; end: Date }, regional: RegionalSettings, now = new Date()) {
  const day = formatDateTime(appointment.start, regional, { weekday: "long", day: "numeric", month: "long" });
  const current: AppointmentTimeInput = {
    date: localDateOf(appointment.start, regional.timeZone),
    time: time(appointment.start, regional),
    durationMinutes: Math.round((appointment.end.getTime() - appointment.start.getTime()) / 60_000),
  };
  return {
    day,
    range: `${time(appointment.start, regional)} a ${time(appointment.end, regional)}`,
    label: `${day}, ${time(appointment.start, regional)}`,
    current,
    started: appointment.start.getTime() <= now.getTime(),
  };
}
