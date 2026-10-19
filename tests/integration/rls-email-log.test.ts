import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!url || !publishableKey || !secretKey)("Registro de emails: solo lo escribe el servidor", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let owner: Client;
  let other: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };

  async function user(label: string, workspaceId: string) {
    const email = `${label}-${run}@example.com`;
    const password = "clave-de-prueba-larga-123";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, role: "owner" }).throwOnError();
    const client = createClient<Database>(url!, publishableKey!, options);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return client;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    for (const key of ["a", "b"] as const) {
      const { data } = await admin.from("workspaces").insert({ slug: `mail${key}-${run}`, name: key }).select("id").single().throwOnError();
      ws[key] = data.id;
    }
    owner = await user("owner-mail", ws.a);
    other = await user("owner-mailb", ws.b);
    await admin.from("email_log").insert({ workspace_id: ws.a, kind: "new_request_artist", recipient: "artist", status: "skipped", detail: "email no configurado" }).throwOnError();
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("los miembros leen su registro; otro estudio y anon no", async () => {
    expect((await owner.from("email_log").select("status").eq("workspace_id", ws.a).throwOnError()).data).toEqual([{ status: "skipped" }]);
    expect((await other.from("email_log").select("id").eq("workspace_id", ws.a).throwOnError()).data).toEqual([]);
    expect((await anon.from("email_log").select("id")).error?.code).toBe("42501");
  });

  it("nadie lo escribe desde la API, ni siquiera el owner", async () => {
    const insert = await owner.from("email_log").insert({ workspace_id: ws.a, kind: "new_request_artist", recipient: "artist", status: "sent" });
    expect(insert.error?.code).toBe("42501");
    const update = await owner.from("email_log").update({ status: "sent" }).eq("workspace_id", ws.a);
    expect(update.error?.code).toBe("42501");
  });

  it("valida tipo, destinatario y estado", async () => {
    const bad = await admin.from("email_log").insert({ workspace_id: ws.a, kind: "spam", recipient: "artist", status: "sent" });
    expect(bad.error?.code).toBe("23514");
  });
});
