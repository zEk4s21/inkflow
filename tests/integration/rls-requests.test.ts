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
  let artistA: Client;
  let staffA: Client;
  let ownerB: Client;
  const userIds: string[] = [];
  const ids = { ownerA: "", artistA: "" };
  const ws = { a: "", b: "" };
  const clients = { a: "", b: "" };

  async function workspace(slug: string) {
    const { data } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
    await admin.from("artist_profiles").insert({ workspace_id: data.id, display_name: slug, is_public: true }).throwOnError();
    return data.id;
  }

  async function user(label: string, workspaceId: string, role: "owner" | "artist" | "staff") {
    const email = `${label}-${run}@example.com`;
    const password = "clave-de-prueba-larga-123";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: data.user.id, role }).throwOnError();
    const client = createClient<Database>(url!, publishableKey!, options);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return { client, id: data.user.id };
  }

  async function requestOf(workspaceId: string) {
    const { data } = await admin.from("tattoo_requests").select("id").eq("workspace_id", workspaceId).limit(1).single().throwOnError();
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

    const owner = await user("owner-sol", ws.a, "owner");
    const artist = await user("artist-sol", ws.a, "artist");
    ownerA = owner.client;
    artistA = artist.client;
    ids.ownerA = owner.id;
    ids.artistA = artist.id;
    staffA = (await user("staff-sol", ws.a, "staff")).client;
    ownerB = (await user("owner-solb", ws.b, "owner")).client;
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

  it("los miembros no crean clientes ni editan otra cosa que el estado", async () => {
    const insert = await ownerA.from("clients").insert({ workspace_id: ws.a, name: "Otro", phone: "1122334455" });
    expect(insert.error).not.toBeNull();
    const idea = await ownerA.from("tattoo_requests").update({ idea: "Idea cambiada por el panel" }).eq("workspace_id", ws.a);
    expect(idea.error).not.toBeNull();
  });

  it("owner o artista cambian el estado y queda en el historial con su usuario", async () => {
    const requestId = await requestOf(ws.a);
    const { data } = await ownerA.from("tattoo_requests").update({ status: "reviewing" }).eq("id", requestId).select("id").throwOnError();
    expect(data).toHaveLength(1);
    await artistA.from("tattoo_requests").update({ status: "quoted" }).eq("id", requestId).throwOnError();
    // Guardar el mismo estado no suma una fila.
    await artistA.from("tattoo_requests").update({ status: "quoted" }).eq("id", requestId).throwOnError();

    const { data: history } = await ownerA
      .from("request_status_history")
      .select("from_status, to_status, changed_by")
      .eq("request_id", requestId)
      .order("created_at")
      .throwOnError();
    expect(history).toEqual([
      { from_status: "new", to_status: "reviewing", changed_by: ids.ownerA },
      { from_status: "reviewing", to_status: "quoted", changed_by: ids.artistA },
    ]);
  });

  it("staff y otros workspaces no cambian el estado; nadie escribe el historial a mano", async () => {
    const requestId = await requestOf(ws.a);
    const byStaff = await staffA.from("tattoo_requests").update({ status: "rejected" }).eq("id", requestId).select("id");
    expect(byStaff.data ?? []).toHaveLength(0);
    const byOther = await ownerB.from("tattoo_requests").update({ status: "rejected" }).eq("id", requestId).select("id");
    expect(byOther.data ?? []).toHaveLength(0);
    const { data: row } = await admin.from("tattoo_requests").select("status").eq("id", requestId).single().throwOnError();
    expect(row.status).not.toBe("rejected");

    const forged = await ownerA
      .from("request_status_history")
      .insert({ workspace_id: ws.a, request_id: requestId, from_status: "new", to_status: "completed" });
    expect(forged.error).not.toBeNull();
    expect((await ownerB.from("request_status_history").select("id").eq("request_id", requestId)).data ?? []).toHaveLength(0);
  });

  it("notas: owner o artista escriben, staff y anon no, y no se firman por otro", async () => {
    const requestId = await requestOf(ws.a);
    await ownerA.from("request_notes").insert({ workspace_id: ws.a, request_id: requestId, body: "Pasar presupuesto" }).throwOnError();
    expect((await staffA.from("request_notes").insert({ workspace_id: ws.a, request_id: requestId, body: "Hola" })).error).not.toBeNull();
    expect((await anon.from("request_notes").select("id")).error).not.toBeNull();
    const forged = await ownerA
      .from("request_notes")
      .insert({ workspace_id: ws.a, request_id: requestId, body: "Firmada por otro", author_id: ids.artistA });
    expect(forged.error).not.toBeNull();
    // Una solicitud de otro workspace no se puede anotar aunque se ponga el workspace propio.
    const foreign = await requestOf(ws.b);
    expect((await ownerA.from("request_notes").insert({ workspace_id: ws.a, request_id: foreign, body: "Cruce" })).error).not.toBeNull();

    const { data: staffView } = await staffA.from("request_notes").select("body, author_id").eq("request_id", requestId).throwOnError();
    expect(staffView).toEqual([{ body: "Pasar presupuesto", author_id: ids.ownerA }]);
    expect((await ownerB.from("request_notes").select("id").eq("request_id", requestId)).data ?? []).toHaveLength(0);
  });

  it("cada uno borra solo sus notas, y solo con borrado lógico", async () => {
    const requestId = await requestOf(ws.a);
    const { data: note } = await artistA
      .from("request_notes")
      .insert({ workspace_id: ws.a, request_id: requestId, body: "Nota del artista" })
      .select("id")
      .single()
      .throwOnError();
    const byOwner = await ownerA.from("request_notes").update({ deleted_at: new Date().toISOString() }).eq("id", note.id).select("id");
    expect(byOwner.data ?? []).toHaveLength(0);
    expect((await artistA.from("request_notes").update({ body: "Editada" }).eq("id", note.id)).error).not.toBeNull();
    expect((await artistA.from("request_notes").delete().eq("id", note.id)).error).not.toBeNull();
    const byAuthor = await artistA.from("request_notes").update({ deleted_at: new Date().toISOString() }).eq("id", note.id).select("id");
    expect(byAuthor.data).toHaveLength(1);
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
