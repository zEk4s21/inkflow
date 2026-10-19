import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];
const options = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!url || !publishableKey || !secretKey)("Presupuestos: privilegios, RLS y estados", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let ownerA: Client;
  let staffA: Client;
  let ownerB: Client;
  const userIds: string[] = [];
  const a = { ws: "", client: "" };
  const b = { ws: "", client: "", request: "" };

  async function workspace(slug: string) {
    const { data } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
    const { data: client } = await admin
      .from("clients")
      .insert({ workspace_id: data.id, name: "Ana", email: `ana-${slug}@example.com` })
      .select("id")
      .single()
      .throwOnError();
    return { ws: data.id, client: client.id };
  }

  async function request(target: { ws: string; client: string }, status = "new") {
    const { data } = await admin
      .from("tattoo_requests")
      .insert({ workspace_id: target.ws, client_id: target.client, idea: "Una golondrina en el antebrazo.", status })
      .select("id")
      .single()
      .throwOnError();
    return data.id;
  }

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

  const quote = (requestId: string, overrides: Partial<QuoteInsert> = {}): QuoteInsert => ({
    workspace_id: a.ws,
    request_id: requestId,
    amount: 120000,
    deposit: 30000,
    currency: "ARS",
    ...overrides,
  });

  async function requestStatus(id: string) {
    const { data } = await admin.from("tattoo_requests").select("status").eq("id", id).single().throwOnError();
    return data.status;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    Object.assign(a, await workspace(`quoa-${run}`));
    Object.assign(b, await workspace(`quob-${run}`));
    b.request = await request(b);
    ownerA = await user("owner-quoa", a.ws, "owner");
    staffA = await user("staff-quoa", a.ws, "staff");
    ownerB = await user("owner-quob", b.ws, "owner");
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [a.ws, b.ws].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("anon no lee ni crea presupuestos", async () => {
    const requestId = await request(a);
    const read = await anon.from("quotes").select("id");
    expect(read.error?.code).toBe("42501");
    const insert = await anon.from("quotes").insert(quote(requestId));
    expect(insert.error?.code).toBe("42501");
  });

  it("owner arma un borrador; staff lo ve pero no lo crea ni lo cambia; otro estudio no lo ve", async () => {
    const requestId = await request(a);
    const { data } = await ownerA.from("quotes").insert(quote(requestId)).select("id, status, created_by").single().throwOnError();
    expect(data.status).toBe("draft");
    expect(data.created_by).not.toBeNull();

    const seen = await staffA.from("quotes").select("id").eq("id", data.id).throwOnError();
    expect(seen.data).toHaveLength(1);
    const staffInsert = await staffA.from("quotes").insert(quote(await request(a)));
    expect(staffInsert.error?.code).toBe("42501");
    const staffUpdate = await staffA.from("quotes").update({ status: "sent" }).eq("id", data.id).select("id");
    expect(staffUpdate.data).toEqual([]);

    const other = await ownerB.from("quotes").select("id").eq("id", data.id).throwOnError();
    expect(other.data).toEqual([]);
    const otherUpdate = await ownerB.from("quotes").update({ amount: 1 }).eq("id", data.id).select("id");
    expect(otherUpdate.data).toEqual([]);
  });

  it("no se arma sobre una solicitud de otro estudio ni con un estado cerrado", async () => {
    const crossed = await ownerA.from("quotes").insert(quote(b.request));
    expect(crossed.error).not.toBeNull();
    const viaAdmin = await admin.from("quotes").insert(quote(b.request));
    expect(viaAdmin.error?.code).toBe("23514");
    const accepted = await ownerA.from("quotes").insert(quote(await request(a), { status: "accepted" }));
    expect(accepted.error?.code).toBe("42501");
  });

  it("la seña no supera el total y el monto es positivo", async () => {
    const requestId = await request(a);
    expect((await ownerA.from("quotes").insert(quote(requestId, { deposit: 200000 }))).error?.code).toBe("23514");
    expect((await ownerA.from("quotes").insert(quote(requestId, { amount: 0, deposit: null }))).error?.code).toBe("23514");
  });

  it("hay un solo presupuesto abierto por solicitud; retirado, se puede armar otro", async () => {
    const requestId = await request(a);
    const { data: first } = await ownerA.from("quotes").insert(quote(requestId)).select("id").single().throwOnError();
    const second = await ownerA.from("quotes").insert(quote(requestId));
    expect(second.error?.code).toBe("23505");
    await ownerA.from("quotes").update({ status: "withdrawn" }).eq("id", first.id).throwOnError();
    await ownerA.from("quotes").insert(quote(requestId)).throwOnError();
  });

  it("enviado: anota la fecha, pasa la solicitud a presupuestada y ya no se edita", async () => {
    const requestId = await request(a, "reviewing");
    const { data } = await ownerA.from("quotes").insert(quote(requestId)).select("id").single().throwOnError();
    await ownerA.from("quotes").update({ amount: 150000 }).eq("id", data.id).throwOnError();

    const { data: sent } = await ownerA.from("quotes").update({ status: "sent" }).eq("id", data.id).select("sent_at").single().throwOnError();
    expect(sent.sent_at).not.toBeNull();
    expect(await requestStatus(requestId)).toBe("quoted");

    const edit = await ownerA.from("quotes").update({ amount: 1000 }).eq("id", data.id);
    expect(edit.error?.code).toBe("23514");
    const back = await ownerA.from("quotes").update({ status: "draft" }).eq("id", data.id);
    expect(back.error?.code).toBe("23514");
  });

  it("aceptado: pasa la solicitud a aceptada y queda cerrado", async () => {
    const requestId = await request(a);
    const { data } = await ownerA.from("quotes").insert(quote(requestId, { status: "sent" })).select("id, sent_at").single().throwOnError();
    expect(data.sent_at).not.toBeNull();
    expect(await requestStatus(requestId)).toBe("quoted");

    const { data: accepted } = await ownerA
      .from("quotes")
      .update({ status: "accepted" })
      .eq("id", data.id)
      .select("responded_at")
      .single()
      .throwOnError();
    expect(accepted.responded_at).not.toBeNull();
    expect(await requestStatus(requestId)).toBe("accepted");

    const reopen = await ownerA.from("quotes").update({ status: "withdrawn" }).eq("id", data.id);
    expect(reopen.error?.code).toBe("23514");
  });

  it("no pisa un estado que el tatuador puso a mano ni deja aceptar un borrador", async () => {
    const requestId = await request(a, "rejected");
    const { data } = await ownerA.from("quotes").insert(quote(requestId, { status: "sent" })).select("id").single().throwOnError();
    expect(await requestStatus(requestId)).toBe("rejected");
    await ownerA.from("quotes").update({ status: "accepted" }).eq("id", data.id).throwOnError();
    expect(await requestStatus(requestId)).toBe("rejected");

    const draftRequest = await request(a);
    const { data: draft } = await ownerA.from("quotes").insert(quote(draftRequest)).select("id").single().throwOnError();
    const skip = await ownerA.from("quotes").update({ status: "accepted" }).eq("id", draft.id);
    expect(skip.error?.code).toBe("23514");
  });

  it("no se puede mover a otra solicitud ni cambiar la moneda", async () => {
    const requestId = await request(a);
    const { data } = await ownerA.from("quotes").insert(quote(requestId)).select("id").single().throwOnError();
    const move = await admin.from("quotes").update({ request_id: await request(a) }).eq("id", data.id);
    expect(move.error?.code).toBe("23514");
    const currency = await admin.from("quotes").update({ currency: "USD" }).eq("id", data.id);
    expect(currency.error?.code).toBe("23514");
  });
});
