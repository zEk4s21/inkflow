import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!url || !publishableKey || !secretKey)("RLS de clientes y solicitudes", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let ownerA: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };
  const clients = { a: "", b: "" };

  async function workspace(slug: string) {
    const { data } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
    await admin.from("artist_profiles").insert({ workspace_id: data.id, display_name: slug, is_public: true }).throwOnError();
    return data.id;
  }

  async function seedRequest(workspaceId: string, email: string) {
    const { data } = await admin
      .from("clients")
      .insert({ workspace_id: workspaceId, name: "Cliente", email })
      .select("id")
      .single()
      .throwOnError();
    await admin
      .from("tattoo_requests")
      .insert({ workspace_id: workspaceId, client_id: data.id, idea: "Una golondrina en el antebrazo" })
      .throwOnError();
    return data.id;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    ws.a = await workspace(`sola-${run}`);
    ws.b = await workspace(`solb-${run}`);
    clients.a = await seedRequest(ws.a, `cliente-a-${run}@example.com`);
    clients.b = await seedRequest(ws.b, `cliente-b-${run}@example.com`);

    const email = `owner-sol-${run}@example.com`;
    const password = "clave-de-prueba-larga-123";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    await admin.from("workspace_members").insert({ workspace_id: ws.a, user_id: data.user.id, role: "owner" }).throwOnError();
    ownerA = createClient<Database>(url!, publishableKey!, options);
    const signIn = await ownerA.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("anon no lee ni escribe clientes ni solicitudes", async () => {
    expect((await anon.from("clients").select("id")).error).not.toBeNull();
    expect((await anon.from("tattoo_requests").select("id")).error).not.toBeNull();
    const insertClient = await anon.from("clients").insert({ workspace_id: ws.a, name: "Bot", email: `bot-${run}@example.com` });
    expect(insertClient.error).not.toBeNull();
    const insertRequest = await anon
      .from("tattoo_requests")
      .insert({ workspace_id: ws.a, client_id: clients.a, idea: "Spam spam spam spam" });
    expect(insertRequest.error).not.toBeNull();
  });

  it("un miembro ve solo las solicitudes y clientes de su workspace", async () => {
    const { data: requests } = await ownerA.from("tattoo_requests").select("workspace_id").throwOnError();
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((row) => row.workspace_id === ws.a)).toBe(true);
    const { data: rows } = await ownerA.from("clients").select("id").throwOnError();
    expect(rows.map((row) => row.id)).toContain(clients.a);
    expect(rows.map((row) => row.id)).not.toContain(clients.b);
  });

  it("los miembros todavía no pueden escribir (llega en 2.6 y 2.7)", async () => {
    const update = await ownerA.from("tattoo_requests").update({ status: "reviewing" }).eq("workspace_id", ws.a);
    expect(update.error).not.toBeNull();
    const insert = await ownerA.from("clients").insert({ workspace_id: ws.a, name: "Otro", phone: "1122334455" });
    expect(insert.error).not.toBeNull();
  });

  it("deduplica por email sin importar mayúsculas", async () => {
    const duplicate = await admin
      .from("clients")
      .insert({ workspace_id: ws.a, name: "Repetido", email: `CLIENTE-A-${run}@example.com` });
    expect(duplicate.error?.code).toBe("23505");
  });

  it("una solicitud no puede apuntar a un cliente de otro workspace", async () => {
    const cross = await admin
      .from("tattoo_requests")
      .insert({ workspace_id: ws.a, client_id: clients.b, idea: "Cruce de workspaces" });
    expect(cross.error).not.toBeNull();
  });
});
