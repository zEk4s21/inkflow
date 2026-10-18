import { z } from "zod";

/** Día, hora local de inicio y duración de un turno, como los carga el tatuador. */
export const appointmentTimeSchema = z.object({
  date: z.iso.date({ error: "Fecha inválida." }),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida."),
  durationMinutes: z.number().int().min(30, "Mínimo 30 minutos.").max(720, "Máximo 12 horas."),
});

export type AppointmentTimeInput = z.input<typeof appointmentTimeSchema>;

/** Cambios de estado que se ofrecen desde el panel. La base valida las transiciones. */
export const appointmentStatusChangeSchema = z.enum(["confirmed", "cancelled", "completed", "no_show"]);

export type AppointmentStatusChange = z.infer<typeof appointmentStatusChangeSchema>;
