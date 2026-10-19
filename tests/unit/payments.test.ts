import { describe, expect, it } from "vitest";
import { paymentFormSchema, paymentTotals, referenceQuote } from "@/server/payments/schemas";

describe("paymentTotals", () => {
  it("suma señas y pagos, resta devoluciones e ignora anulados", () => {
    const totals = paymentTotals(
      [
        { amount: 20000, kind: "deposit", voided: false },
        { amount: 50000.1, kind: "payment", voided: false },
        { amount: 0.2, kind: "payment", voided: false },
        { amount: 5000, kind: "refund", voided: false },
        { amount: 99999, kind: "payment", voided: true },
      ],
      90000,
    );
    expect(totals).toEqual({ paid: 65000.3, balance: 24999.7 });
  });

  it("sin presupuesto no hay saldo; cobrar de más da saldo negativo", () => {
    expect(paymentTotals([], null)).toEqual({ paid: 0, balance: null });
    expect(paymentTotals([{ amount: 100, kind: "payment", voided: false }], 80).balance).toBe(-20);
  });
});

describe("referenceQuote", () => {
  it("prefiere el último aceptado, si no el último enviado", () => {
    expect(referenceQuote([{ id: 1, status: "sent" }, { id: 2, status: "accepted" }])?.id).toBe(2);
    expect(referenceQuote([{ id: 1, status: "draft" }, { id: 2, status: "sent" }, { id: 3, status: "sent" }])?.id).toBe(2);
    expect(referenceQuote([{ id: 1, status: "withdrawn" }, { id: 2, status: "draft" }])).toBeNull();
  });
});

describe("paymentFormSchema", () => {
  const base = { amount: "20.000", kind: "deposit", method: "transfer", paidOn: "2026-10-19", note: " " };

  it("acepta un pago y vacía la nota en blanco", () => {
    expect(paymentFormSchema.parse(base)).toEqual({ amount: 20000, kind: "deposit", method: "transfer", paidOn: "2026-10-19", note: null });
  });

  it("marca el campo con error", () => {
    const issues = (values: Partial<typeof base>) =>
      paymentFormSchema.safeParse({ ...base, ...values }).error?.issues.map((issue) => issue.path.join("."));
    expect(issues({ amount: "0" })).toEqual(["amount"]);
    expect(issues({ kind: "regalo" })).toEqual(["kind"]);
    expect(issues({ method: "cripto" })).toEqual(["method"]);
    expect(issues({ paidOn: "" })).toEqual(["paidOn"]);
    expect(issues({ note: "x".repeat(301) })).toEqual(["note"]);
  });
});
