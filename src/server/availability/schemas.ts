import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");
const date = z.iso.date({ error: "Fecha inválida." });

export const SLOT_OPTIONS = [60, 90, 120, 180, 240, 300, 360, 480] as const;
export const BUFFER_OPTIONS = [0, 15, 30, 45, 60] as const;

/** Anticipación mínima para pedir un turno. */
export const MIN_NOTICE_MINUTES = 24 * 60;

export const weeklyAvailabilitySchema = z.object({
  slotMinutes: z.number().int().min(30).max(720),
  bufferMinutes: z.number().int().min(0).max(240),
  days: z
    .array(
      z
        .object({ weekday: z.number().int().min(1).max(7), enabled: z.boolean(), start: time, end: time })
        .refine((day) => !day.enabled || day.end > day.start, { message: "La hora de cierre tiene que ser después de la de inicio.", path: ["end"] }),
    )
    .length(7),
});

export type WeeklyAvailabilityInput = z.input<typeof weeklyAvailabilitySchema>;

export const blockSchema = z
  .object({
    startDate: date,
    endDate: date,
    allDay: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().trim().max(120, "Máximo 120 caracteres."),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({ code: "custom", message: "La fecha de fin es anterior a la de inicio.", path: ["endDate"] });
    }
    if (!value.allDay) {
      if (!time.safeParse(value.startTime).success) ctx.addIssue({ code: "custom", message: "Hora inválida.", path: ["startTime"] });
      if (!time.safeParse(value.endTime).success) ctx.addIssue({ code: "custom", message: "Hora inválida.", path: ["endTime"] });
      if (value.startDate === value.endDate && value.endTime <= value.startTime) {
        ctx.addIssue({ code: "custom", message: "Tiene que terminar después de empezar.", path: ["endTime"] });
      }
    }
  });

export type BlockInput = z.input<typeof blockSchema>;

/** Rango de Postgres `["2026-10-19 03:00:00+00","2026-10-20 03:00:00+00")` → fechas. */
export function parseTstzRange(value: string) {
  const match = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/.exec(value);
  if (!match) return null;
  const start = new Date(match[1].replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  const end = new Date(match[2].replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? null : { start, end };
}
