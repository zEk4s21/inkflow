import { describe, expect, it } from "vitest";
import { formatPhone, whatsappUrl } from "@/lib/phone";

describe("formatPhone", () => {
  it("muestra los números argentinos legibles", () => {
    expect(formatPhone("5491131291602")).toBe("+54 9 11 3129-1602");
    expect(formatPhone("5492214123456")).toBe("+54 9 2214123456");
    expect(formatPhone("34612345678")).toBe("+34612345678");
  });
});

describe("whatsappUrl", () => {
  it("arma el link de wa.me con o sin mensaje", () => {
    expect(whatsappUrl("5491131291602")).toBe("https://wa.me/5491131291602");
    expect(whatsappUrl("5491131291602", "Hola & chau")).toBe("https://wa.me/5491131291602?text=Hola%20%26%20chau");
  });
});
