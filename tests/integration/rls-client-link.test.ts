import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const hash = (char: string) => char.repeat(64);

describe.skipIf(!url || !publishableKey || !secretKey)("Link para el cliente: privilegios y RLS", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let owner: Client;
  let staff: Client;
  let other: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };
  const requests: string[] = [];

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

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    for (const key of ["a", "b"] as const) {
      const { data } = await admin.from("workspaces").insert({ slug: `link${key}-${run}`, name: key }).select("id").single().throwOnError();
      ws[key] = data.id;
    }
    const { data: client } = await admin
      .from("clients")
      .insert({ workspace_id: ws.a, name: "Ana", email: `ana-${run}@example.com` })
      .select("id")
      .single()
      .throwOnError();
    for (let i = 0; i < 2; i++) {
      const { data } = await admin
        .from("tattoo_requests")
        .insert({ workspace_id: ws.a, client_id: client.id, idea: "Una rosa en el antebrazo." })
        .select("id")
        .single()
        .throwOnError();
      requests.push(data.id);
    }
    owner = await user("owner-link", ws.a, "owner");
    staff = await user("staff-link", ws.a, "staff");
    other = await user("owner-linkb", ws.b, "owner");
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  const link = (value: string | null) => ({ public_token_hash: value, public_token_created_at: value ? new Date().toISOString() : null });

  it("owner genera y desactiva el link", async () => {
    const { data } = await owner.from("tattoo_requests").update(link(hash("a"))).eq("id", requests[0]).select("public_token_hash").single().throwOnError();
    expect(data.public_token_hash).toBe(hash("a"));
    await owner.from("tattoo_requests").update(link(null)).eq("id", requests[0]).throwOnError();
  });

  it("staff y otro estudio no lo tocan; anon no lee solicitudes", async () => {
    const byStaff = await staff.from("tattoo_requests").update(link(hash("b"))).eq("id", requests[0]).select("id");
    expect(byStaff.data).toEqual([]);
    const byOther = await other.from("tattoo_requests").update(link(hash("b"))).eq("id", requests[0]).select("id");
    expect(byOther.data).toEqual([]);
    const read = await anon.from("tattoo_requests").select("id").eq("public_token_hash", hash("b"));
    expect(read.error?.code).toBe("42501");
  });

  it("exige un sha256 en hex, con su fecha, y único", async () => {
    const plain = await owner.from("tattoo_requests").update(link("token-en-claro")).eq("id", requests[0]);
    expect(plain.error?.code).toBe("23514");
    const noDate = await owner.from("tattoo_requests").update({ public_token_hash: hash("c") }).eq("id", requests[0]);
    expect(noDate.error?.code).toBe("23514");
    await owner.from("tattoo_requests").update(link(hash("d"))).eq("id", requests[0]).throwOnError();
    const duplicate = await owner.from("tattoo_requests").update(link(hash("d"))).eq("id", requests[1]);
    expect(duplicate.error?.code).toBe("23505");
  });

  it("cambiar el link no deja otras columnas editables", async () => {
    const idea = await owner.from("tattoo_requests").update({ idea: "Otra idea distinta para probar." }).eq("id", requests[1]);
    expect(idea.error?.code).toBe("42501");
  });
});
