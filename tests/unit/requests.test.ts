import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { verifyTurnstile } = await import("@/server/requests/captcha");
const { clientIp, submitterHash } = await import("@/server/requests/rate-limit");
const { clientFormSchema, requestFormSchema, normalizePhone } = await import("@/server/requests/schemas");

const base = {
  name: "Ana",
  email: "",
  phone: "",
  instagramHandle: "",
  idea: "Una rosa en el antebrazo, en negro y gris.",
  bodyZone: "",
  sizeLabel: "",
};

describe("requestFormSchema", () => {
  it("exige algún contacto: WhatsApp, email o Instagram", () => {
    const result = requestFormSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["phone"]);
  });

  it("acepta Instagram como único contacto", () => {
    const parsed = requestFormSchema.parse({ ...base, instagramHandle: "@ana.tattoo" });
    expect(parsed.instagramHandle).toBe("ana.tattoo");
    expect(parsed.email).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("normaliza email y teléfono", () => {
    const parsed = requestFormSchema.parse({ ...base, email: " Ana@Mail.com ", phone: "+54 9 11 2233-4455" });
    expect(parsed.email).toBe("ana@mail.com");
    expect(parsed.phone).toBe("5491122334455");
  });

  it("rechaza una idea demasiado corta", () => {
    expect(requestFormSchema.safeParse({ ...base, email: "a@b.co", idea: "rosa" }).success).toBe(false);
  });

  it("el turno es opcional y, si viene, tiene que ser una fecha ISO", () => {
    const withContact = { ...base, email: "a@b.co" };
    expect(requestFormSchema.parse(withContact).slot).toBeNull();
    expect(requestFormSchema.parse({ ...withContact, slot: "" }).slot).toBeNull();
    expect(requestFormSchema.parse({ ...withContact, slot: "2030-03-04T13:00:00.000Z" }).slot).toBe("2030-03-04T13:00:00.000Z");
    expect(requestFormSchema.safeParse({ ...withContact, slot: "mañana a la tarde" }).success).toBe(false);
  });

  it("normalizePhone completa los números argentinos para wa.me", () => {
    for (const written of ["11 2233-4455", "(011) 15-2233-4455", "+54 9 11 2233-4455", "54 11 2233-4455", "011 2233 4455"]) {
      expect(normalizePhone(written), written).toBe("5491122334455");
    }
    expect(normalizePhone("0221 15 412-3456")).toBe("5492214123456");
    expect(normalizePhone("5491122334455")).toBe("5491122334455");
  });

  it("normalizePhone respeta otros países si vienen con +", () => {
    expect(normalizePhone("+34 612 345 678")).toBe("34612345678");
    expect(normalizePhone("+1 (415) 555-0100")).toBe("14155550100");
    expect(normalizePhone("0034 612 345 678")).toBe("34612345678");
    expect(normalizePhone("")).toBe("");
  });
});

describe("verifyTurnstile", () => {
  const ok = (success: boolean) => vi.fn(async () => new Response(JSON.stringify({ success }), { status: 200 }));

  it("acepta solo si Cloudflare responde success", async () => {
    expect(await verifyTurnstile("token", "secret", "1.2.3.4", ok(true))).toBe(true);
    expect(await verifyTurnstile("token", "secret", null, ok(false))).toBe(false);
  });

  it("falla cerrado ante errores de red o token vacío", async () => {
    const broken = vi.fn(async () => {
      throw new Error("sin red");
    });
    expect(await verifyTurnstile("token", "secret", null, broken)).toBe(false);
    const spy = ok(true);
    expect(await verifyTurnstile("", "secret", null, spy)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("rate limit", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBeNull();
  });

  it("el hash no expone la IP y depende de la clave", () => {
    const hash = submitterHash("203.0.113.5", "clave");
    expect(hash).not.toContain("203");
    expect(hash).toBe(submitterHash("203.0.113.5", "clave"));
    expect(hash).not.toBe(submitterHash("203.0.113.5", "otra"));
  });
});

describe("clientFormSchema", () => {
  const client = { name: "Ana", email: "", phone: "", instagramHandle: "" };

  it("normaliza los datos de contacto", () => {
    const parsed = clientFormSchema.parse({ ...client, email: " Ana@Mail.com ", phone: "+54 9 11 2233-4455", instagramHandle: "@ana.tattoo" });
    expect(parsed).toEqual({ name: "Ana", email: "ana@mail.com", phone: "5491122334455", instagramHandle: "ana.tattoo" });
  });

  it("no deja al cliente sin ningún contacto", () => {
    const result = clientFormSchema.safeParse({ ...client, instagramHandle: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["phone"]);
  });

  it("alcanza con el Instagram del cliente", () => {
    expect(clientFormSchema.safeParse({ ...client, instagramHandle: "ana" }).success).toBe(true);
  });
});
