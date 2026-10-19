import { z } from "zod";

export const followUpFormSchema = z.object({
  dueOn: z.iso.date({ error: "Elegí una fecha." }),
  note: z.string().trim().min(1, "Contá qué hay que hacer.").max(300, "Máximo 300 caracteres."),
});

export type FollowUpFormInput = z.input<typeof followUpFormSchema>;

/** Vencido, hoy o más adelante, comparando fechas locales del estudio (YYYY-MM-DD). */
export function followUpTiming(dueOn: string, today: string): "overdue" | "today" | "upcoming" {
  return dueOn < today ? "overdue" : dueOn === today ? "today" : "upcoming";
}

/** Suma días a una fecha YYYY-MM-DD sin pasar por la zona horaria del servidor. */
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
