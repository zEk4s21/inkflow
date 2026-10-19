import { z } from "zod";

/**
 * Monto escrito a mano: "45.000", "45000", "45.000,50" o "$ 45.000". Con coma, la coma es el
 * decimal y los puntos son miles; sin coma, un punto seguido de tres cifras también es de miles.
 * Devuelve NaN si no es un número.
 */
export function parseMoneyInput(value: string): number {
  let text = value.replace(/[\s$]/g, "");
  if (text === "") return Number.NaN;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  return /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : Number.NaN;
}

const money = z
  .string()
  .transform(parseMoneyInput)
  .pipe(z.number({ error: "Escribí un monto, por ejemplo 45.000." }).positive("Tiene que ser mayor a cero.").max(9_999_999_999, "Monto demasiado alto."));

export const quoteFormSchema = z
  .object({
    amount: money,
    deposit: z.string().transform((value) => (value.trim() === "" ? null : value)).pipe(money.nullable()),
    estimatedSessions: z
      .string()
      .transform((value) => (value.trim() === "" ? null : Number(value)))
      .pipe(z.number().int("Tiene que ser un número entero.").min(1, "Mínimo 1.").max(20, "Máximo 20.").nullable()),
    validUntil: z
      .string()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.iso.date({ error: "Fecha inválida." }).nullable()),
    message: z
      .string()
      .trim()
      .max(1000, "Máximo 1000 caracteres.")
      .transform((value) => (value === "" ? null : value)),
  })
  .refine((values) => values.deposit === null || values.deposit <= values.amount, {
    message: "La seña no puede ser mayor que el total.",
    path: ["deposit"],
  });

export type QuoteFormInput = z.input<typeof quoteFormSchema>;

export const QUOTE_STATUS_CHANGES = ["sent", "accepted", "rejected", "withdrawn"] as const;
export const quoteStatusChangeSchema = z.enum(QUOTE_STATUS_CHANGES);
export type QuoteStatusChange = z.infer<typeof quoteStatusChangeSchema>;
