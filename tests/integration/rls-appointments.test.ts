import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseTstzRange } from "@/server/availability/schemas";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const range = (start: string, end: string) => `[${start},${end})`;

describe.skipIf(!url || !publishableKey || !secretKey)("Turnos: privilegios, RLS y superposición", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let ownerA: Client;
  let ownerB: Client;
  const userIds: string[] = [];
  const a = { ws: "", artist: "", client: "", request: "" };
  const b = { ws: "", artist: "", client: "" };

  async function workspace(slug: string) {
    const { data } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
    const { data: profile } = await admin
      .from("artist_profiles")
      .insert({ workspace_id: data.id, display_name: slug, is_public: true })
      .select("id")
      .single()
      .throwOnError();
    const { data: client } = await admin
      .from("clients")
      .insert({ workspace_id: data.id, name: "Ana", email: `ana-${slug}@example.com` })
      .select("id")
      .single()
      .throwOnError();
    return { ws: data.id, artist: profile.id, client: client.id };
  }

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

  const appointment = (overrides: Partial<Database["public"]["Tables"]["appointments"]["Insert"]> = {}) => ({
    workspace_id: a.ws,
    artist_id: a.artist,
    client_id: a.client,
    period: range("2030-03-04T13:00:00Z", "2030-03-04T16:00:00Z"),
    buffer_minutes: 30,
    ...overrides,
  });

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    Object.assign(a, await workspace(`tura-${run}`));
    Object.assign(b, await workspace(`turb-${run}`));
    const { data: request } = await admin
      .from("tattoo_requests")
      .insert({ workspace_id: a.ws, client_id: a.client, idea: "Una rosa en el antebrazo." })
      .select("id")
      .single()
      .throwOnError();
    a.request = request.id;
    ownerA = await user("owner-tura", a.ws);
    ownerB = await user("owner-turb", b.ws);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [a.ws, b.ws].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("un pedido queda requested y el margen se suma al período bloqueado", async () => {
    const { data } = await admin
      .from("appointments")
      .insert(appointment({ request_id: a.request }))
      .select("status, blocked_period")
      .single()
      .throwOnError();
    expect(data.status).toBe("requested");
    const blocked = parseTstzRange(data.blocked_period as string);
    expect(blocked?.start.toISOString()).toBe("2030-03-04T13:00:00.000Z");
    expect(blocked?.end.toISOString()).toBe("2030-03-04T16:30:00.000Z");
  });

  it("anon no lee ni crea turnos", async () => {
    const read = await anon.from("appointments").select("id");
    expect(read.error?.code).toBe("42501");
    const insert = await anon.from("appointments").insert(appointment());
    expect(insert.error?.code).toBe("42501");
  });

  it("cada estudio ve solo sus turnos y ningún miembro los escribe directo", async () => {
    const own = await ownerA.from("appointments").select("id").eq("workspace_id", a.ws).throwOnError();
    expect(own.data?.length).toBeGreaterThan(0);
    const other = await ownerB.from("appointments").select("id").eq("workspace_id", a.ws).throwOnError();
    expect(other.data).toEqual([]);
    const insert = await ownerA.from("appointments").insert(appointment());
    expect(insert.error?.code).toBe("42501");
  });

  it("no mezcla tatuador, cliente o solicitud de otro estudio", async () => {
    for (const overrides of [{ artist_id: b.artist }, { client_id: b.client }, { workspace_id: b.ws }]) {
      const { error } = await admin.from("appointments").insert(appointment(overrides));
      expect(error?.code).toBe("23514");
    }
  });

  it("dos pedidos pueden coincidir, pero no dos turnos confirmados (con el margen)", async () => {
    await admin.from("appointments").insert([appointment(), appointment()]).throwOnError();
    await admin.from("appointments").insert(appointment({ status: "confirmed" })).throwOnError();
    // Empieza 15 minutos después del fin: cae dentro del margen de 30 del anterior.
    const overlap = await admin
      .from("appointments")
      .insert(appointment({ status: "confirmed", period: range("2030-03-04T16:15:00Z", "2030-03-04T18:00:00Z") }));
    expect(overlap.error?.code).toBe("23P01");
    // Pasado el margen sí entra.
    await admin
      .from("appointments")
      .insert(appointment({ status: "confirmed", period: range("2030-03-04T16:30:00Z", "2030-03-04T18:00:00Z") }))
      .throwOnError();
  });

  it("unir clientes mueve también sus turnos", async () => {
    const { data: duplicate } = await admin
      .from("clients")
      .insert({ workspace_id: a.ws, name: "Ana bis", phone: `54911${run.slice(-8)}` })
      .select("id")
      .single()
      .throwOnError();
    const { data: moved } = await admin
      .from("appointments")
      .insert(appointment({ client_id: duplicate.id, period: range("2030-04-01T13:00:00Z", "2030-04-01T16:00:00Z") }))
      .select("id")
      .single()
      .throwOnError();
    await ownerA.rpc("merge_clients", { source: duplicate.id, target: a.client }).throwOnError();
    const { data } = await admin.from("appointments").select("client_id").eq("id", moved.id).single().throwOnError();
    expect(data.client_id).toBe(a.client);
  });
});
