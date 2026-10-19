import { describe, expect, it } from "vitest";
import { addDays, followUpFormSchema, followUpTiming } from "@/server/follow-ups/schemas";
import { careInstructionsSchema } from "@/server/settings/schemas";

describe("controles", () => {
  it("suma días cruzando meses y años bisiestos", () => {
    expect(addDays("2026-10-19", 7)).toBe("2026-10-26");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("clasifica vencido, hoy y próximo", () => {
    expect(followUpTiming("2026-10-18", "2026-10-19")).toBe("overdue");
    expect(followUpTiming("2026-10-19", "2026-10-19")).toBe("today");
    expect(followUpTiming("2026-10-20", "2026-10-19")).toBe("upcoming");
  });

  it("un control a mano necesita fecha y qué hacer", () => {
    expect(followUpFormSchema.parse({ dueOn: "2026-10-26", note: "  Mandar foto  " })).toEqual({ dueOn: "2026-10-26", note: "Mandar foto" });
    expect(followUpFormSchema.safeParse({ dueOn: "", note: "x" }).success).toBe(false);
    expect(followUpFormSchema.safeParse({ dueOn: "2026-10-26", note: "   " }).success).toBe(false);
  });
});

describe("cuidados", () => {
  it("vacío se guarda como null y tiene tope", () => {
    expect(careInstructionsSchema.parse("   ")).toBeNull();
    expect(careInstructionsSchema.parse(" Lavá con jabón neutro. ")).toBe("Lavá con jabón neutro.");
    expect(careInstructionsSchema.safeParse("x".repeat(4001)).success).toBe(false);
  });
});
