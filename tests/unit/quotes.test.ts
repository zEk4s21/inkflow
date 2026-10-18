import { describe, expect, it } from "vitest";
import { parseMoneyInput, quoteFormSchema } from "@/server/quotes/schemas";

describe("parseMoneyInput", () => {
  it.each([
    ["45000", 45000],
    ["45.000", 45000],
    ["1.250.000", 1250000],
    ["$ 45.000", 45000],
    ["45.000,50", 45000.5],
    ["45000,5", 45000.5],
    ["45000.5", 45000.5],
    ["99.99", 99.99],
  ])("lee %s como %d", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(["", "abc", "45,000,00", "-100", "1.2.3", "45.000,505"])("rechaza %j", (input) => {
    expect(parseMoneyInput(input)).toBeNaN();
  });
});

describe("quoteFormSchema", () => {
  const base = { amount: "120.000", deposit: "", estimatedSessions: "", validUntil: "", message: "  " };

  it("deja vacíos los opcionales", () => {
    expect(quoteFormSchema.parse(base)).toEqual({
      amount: 120000,
      deposit: null,
      estimatedSessions: null,
      validUntil: null,
      message: null,
    });
  });

  it("acepta todos los campos", () => {
    const parsed = quoteFormSchema.parse({ amount: "120.000", deposit: "30.000", estimatedSessions: "2", validUntil: "2026-11-30", message: "Incluye diseño." });
    expect(parsed).toEqual({ amount: 120000, deposit: 30000, estimatedSessions: 2, validUntil: "2026-11-30", message: "Incluye diseño." });
  });

  it("marca el campo con error", () => {
    const issues = (values: Partial<typeof base>) =>
      quoteFormSchema.safeParse({ ...base, ...values }).error?.issues.map((issue) => issue.path.join("."));
    expect(issues({ amount: "" })).toEqual(["amount"]);
    expect(issues({ amount: "0" })).toEqual(["amount"]);
    expect(issues({ deposit: "200.000" })).toEqual(["deposit"]);
    expect(issues({ estimatedSessions: "1.5" })).toEqual(["estimatedSessions"]);
    expect(issues({ estimatedSessions: "21" })).toEqual(["estimatedSessions"]);
    expect(issues({ validUntil: "30/11/2026" })).toEqual(["validUntil"]);
    expect(issues({ message: "x".repeat(1001) })).toEqual(["message"]);
  });
});
