import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];
const options = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!url || !publishableKey || !secretKey)("Pagos: privilegios, RLS y anulación", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let owner: Client;
  let staff: Client;
  let other: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };
  const req = { a: "", b: "" };

  async function user(label: string, workspaceId: string, role: "owner" | "staff") {
    const email = `${label}-${run}@example.com`;
    const password = "clave-de-prueba-larga-123";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, role }).throwOnError();
    const client = createClient<Database>(url!, publishableKey!, options);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return client;
  }

  const payment = (overrides: Partial<PaymentInsert> = {}): PaymentInsert => ({
    workspace_id: ws.a,
    request_id: req.a,
    amount: 20000,
    currency: "ARS",
    kind: "deposit",
    method: "transfer",
    paid_on: "2026-10-19",
    ...overrides,
  });

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    for (const key of ["a", "b"] as const) {
      const { data } = await admin.from("workspaces").insert({ slug: `pago${key}-${run}`, name: key }).select("id").single().throwOnError();
      ws[key] = data.id;
      const { data: client } = await admin
        .from("clients")
        .insert({ workspace_id: data.id, name: "Ana", email: `ana-${key}-${run}@example.com` })
        .select("id")
        .single()
        .throwOnError();
      const { data: request } = await admin
        .from("tattoo_requests")
        .insert({ workspace_id: data.id, client_id: client.id, idea: "Una rosa en el antebrazo." })
        .select("id")
        .single()
        .throwOnError();
      req[key] = request.id;
    }
    owner = await user("owner-pago", ws.a, "owner");
    staff = await user("staff-pago", ws.a, "staff");
    other = await user("owner-pagob", ws.b, "owner");
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("owner registra; staff lo ve pero no registra; otro estudio y anon no lo ven", async () => {
    const { data } = await owner.from("payments").insert(payment()).select("id, created_by").single().throwOnError();
    expect(data.created_by).not.toBeNull();
    expect((await staff.from("payments").select("id").eq("id", data.id).throwOnError()).data).toHaveLength(1);
    expect((await staff.from("payments").insert(payment())).error?.code).toBe("42501");
    expect((await other.from("payments").select("id").eq("id", data.id).throwOnError()).data).toEqual([]);
    expect((await anon.from("payments").select("id")).error?.code).toBe("42501");
  });

  it("no mezcla estudios, no se crea anulado y valida monto, tipo y medio", async () => {
    expect((await owner.from("payments").insert(payment({ request_id: req.b }))).error?.code).toBe("23514");
    expect((await admin.from("payments").insert(payment({ voided_at: new Date().toISOString() }))).error?.code).toBe("23514");
    expect((await owner.from("payments").insert(payment({ amount: 0 }))).error?.code).toBe("23514");
    expect((await owner.from("payments").insert(payment({ kind: "regalo" }))).error?.code).toBe("23514");
    expect((await owner.from("payments").insert(payment({ method: "cripto" }))).error?.code).toBe("23514");
  });

  it("solo se anula, una vez, y queda quién y cuándo", async () => {
    const { data } = await owner.from("payments").insert(payment()).select("id").single().throwOnError();
    expect((await owner.from("payments").update({ amount: 1 } as never).eq("id", data.id)).error?.code).toBe("42501");
    expect((await admin.from("payments").update({ amount: 1 }).eq("id", data.id)).error?.code).toBe("23514");
    expect((await staff.from("payments").update({ voided_at: new Date().toISOString() }).eq("id", data.id).select("id")).data).toEqual([]);

    const { data: voided } = await owner
      .from("payments")
      .update({ voided_at: "2000-01-01T00:00:00Z" })
      .eq("id", data.id)
      .select("voided_at, voided_by")
      .single()
      .throwOnError();
    // La fecha la pone la base, no quien llama.
    expect(new Date(voided.voided_at!).getFullYear()).toBeGreaterThan(2000);
    expect(voided.voided_by).not.toBeNull();
    expect((await owner.from("payments").update({ voided_at: new Date().toISOString() }).eq("id", data.id)).error?.code).toBe("23514");
  });
});
