import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/config/env";

describe("parsePublicEnv", () => {
  it("acepta una configuración completa", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "anon",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }).NEXT_PUBLIC_SITE_URL,
    ).toBe("http://localhost:3000");
  });

  it("falla con un mensaje que nombra la variable faltante", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
