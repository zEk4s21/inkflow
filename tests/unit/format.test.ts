import { describe, expect, it } from "vitest";
import { formatDateTime, formatMoney } from "@/lib/format";
import { DEFAULT_REGIONAL, resolveRegional } from "@/config/regional";

describe("resolveRegional", () => {
  it("usa los valores de Argentina por defecto", () => {
    expect(resolveRegional()).toEqual(DEFAULT_REGIONAL);
  });

  it("aplica overrides del workspace e ignora valores vacíos", () => {
    expect(resolveRegional({ currency: "USD", locale: "" })).toEqual({
      ...DEFAULT_REGIONAL,
      currency: "USD",
    });
  });
});

describe("formatMoney", () => {
  it("formatea en pesos argentinos por defecto", () => {
    const value = formatMoney(150000);
    expect(value).toContain("150.000");
    expect(value).toContain("$");
  });

  it("respeta la moneda configurada", () => {
    expect(formatMoney(10, { currency: "USD", locale: "en-US" })).toBe("$10.00");
  });
});

describe("formatDateTime", () => {
  it("convierte a la hora de Buenos Aires aunque el servidor esté en UTC", () => {
    // 2026-10-14 03:00 UTC = 2026-10-14 00:00 en Argentina (UTC-3)
    const value = formatDateTime(new Date("2026-10-14T03:00:00Z"), null, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(value).toBe("00:00");
  });
});
