/** Tipos y medios de pago. La migración de la Fase 5.3 replica estas listas en CHECKs de Postgres. */
export const PAYMENT_KINDS = ["deposit", "payment", "refund"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: "Seña",
  payment: "Pago",
  refund: "Devolución",
};

export const PAYMENT_METHODS = ["cash", "transfer", "mercadopago", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  mercadopago: "Mercado Pago",
  card: "Tarjeta",
  other: "Otro",
};
