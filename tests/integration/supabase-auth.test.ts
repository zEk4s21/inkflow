import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Requiere Supabase local levantado (`pnpm db:start`) y las variables en el entorno.
describe.skipIf(!url || !key)("Supabase local", () => {
  it("rechaza el registro público de cuentas", async () => {
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: "una-clave-larga-de-prueba",
    });
    expect(data.user).toBeNull();
    expect(error?.message).toMatch(/signups not allowed/i);
  });
});
