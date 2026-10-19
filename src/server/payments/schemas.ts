import { z } from "zod";
import { PAYMENT_KINDS, PAYMENT_METHODS, type PaymentKind } from "@/config/payment";
import { parseMoneyInput } from "@/server/quotes/schemas";

export const paymentFormSchema = z.object({
  amount: z
    .string()
    .transform(parseMoneyInput)
    .pipe(z.number({ error: "Escribí un monto, por ejemplo 20.000." }).positive("Tiene que ser mayor a cero.").max(9_999_999_999, "Monto demasiado alto.")),
  kind: z.enum(PAYMENT_KINDS, { error: "Elegí el tipo." }),
  method: z.enum(PAYMENT_METHODS, { error: "Elegí el medio." }),
  paidOn: z.iso.date({ error: "Fecha inválida." }),
  note: z
    .string()
    .trim()
    .max(300, "Máximo 300 caracteres.")
    .transform((value) => (value === "" ? null : value)),
});

export type PaymentFormInput = z.input<typeof paymentFormSchema>;

/**
 * Cobrado neto (las devoluciones restan; los anulados no cuentan) y saldo contra el total del
 * presupuesto de referencia. Sin presupuesto no hay saldo.
 */
export function paymentTotals(payments: { amount: number; kind: PaymentKind; voided: boolean }[], quoteAmount: number | null) {
  // En centavos, para no arrastrar errores de coma flotante.
  const cents = payments
    .filter((payment) => !payment.voided)
    .reduce((sum, payment) => sum + Math.round(payment.amount * 100) * (payment.kind === "refund" ? -1 : 1), 0);
  const paid = cents / 100;
  return { paid, balance: quoteAmount === null ? null : (Math.round(quoteAmount * 100) - cents) / 100 };
}

/** El presupuesto contra el que se calcula el saldo: el último aceptado o, si no hay, el último enviado. */
export function referenceQuote<T extends { status: string }>(quotesNewestFirst: T[]): T | null {
  return quotesNewestFirst.find((quote) => quote.status === "accepted") ?? quotesNewestFirst.find((quote) => quote.status === "sent") ?? null;
}
