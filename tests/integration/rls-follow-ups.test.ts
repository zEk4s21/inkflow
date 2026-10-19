import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!url || !publishableKey || !secretKey)("Controles y cuidados: privilegios, RLS y agenda automática", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let owner: Client;
  let artist: Client;
  let staff: Client;
  let other: Client;
  const userIds: string[] = [];
  const a = { ws: "", artist: "", client: "", request: "" };
  let wsB = "";

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
    return client;
  }

  async function appointment(start: string, end: string) {
    const { data } = await admin
      .from("appointments")
      .insert({ workspace_id: a.ws, artist_id: a.artist, client_id: a.client, request_id: a.request, period: `[${start},${end})`, status: "confirmed" })
      .select("id")
      .single()
      .throwOnError();
    return data.id;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    const { data: ws } = await admin.from("workspaces").insert({ slug: `ctrl-${run}`, name: "ctrl" }).select("id").single().throwOnError();
    a.ws = ws.id;
    await admin.from("workspace_settings").insert({ workspace_id: a.ws }).throwOnError();
    const { data: profile } = await admin.from("artist_profiles").insert({ workspace_id: a.ws, display_name: "Prueba" }).select("id").single().throwOnError();
    a.artist = profile.id;
    const { data: client } = await admin.from("clients").insert({ workspace_id: a.ws, name: "Ana", email: `ana-${run}@example.com` }).select("id").single().throwOnError();
    a.client = client.id;
    const { data: request } = await admin
      .from("tattoo_requests")
      .insert({ workspace_id: a.ws, client_id: a.client, idea: "Una rosa en el antebrazo." })
      .select("id")
      .single()
      .throwOnError();
    a.request = request.id;
    const { data: b } = await admin.from("workspaces").insert({ slug: `ctrlb-${run}`, name: "b" }).select("id").single().throwOnError();
    wsB = b.id;
    owner = await user("owner-ctrl", a.ws, "owner");
    artist = await user("artist-ctrl", a.ws, "artist");
    staff = await user("staff-ctrl", a.ws, "staff");
    other = await user("owner-ctrlb", wsB, "owner");
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [a.ws, wsB].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("al marcar un turno como realizado se agendan dos controles con la fecha local del estudio, una sola vez", async () => {
    // Termina 00:30 UTC del 5/3: en Buenos Aires todavía es el 4/3.
    const id = await appointment("2026-03-04T21:00:00Z", "2026-03-05T00:30:00Z");
    // Con la sesión del artista, como la Server Action: el trigger corre con sus permisos.
    await artist.from("appointments").update({ status: "completed" }).eq("id", id).throwOnError();
    const { data } = await owner.from("follow_ups").select("kind, due_on").eq("appointment_id", id).order("due_on").throwOnError();
    expect(data).toEqual([
      { kind: "healing_check", due_on: "2026-03-11" },
      { kind: "touch_up", due_on: "2026-04-03" },
    ]);
    // El índice único impide duplicarlos para el mismo turno.
    const duplicate = await admin.from("follow_ups").insert({ workspace_id: a.ws, request_id: a.request, appointment_id: id, kind: "touch_up", due_on: "2026-04-03" });
    expect(duplicate.error?.code).toBe("23505");
  });

  it("staff lee pero no cambia; otro estudio y anon no ven nada", async () => {
    const { data } = await owner
      .from("follow_ups")
      .insert({ workspace_id: a.ws, request_id: a.request, kind: "custom", due_on: "2026-10-26", note: "Mandar foto" })
      .select("id")
      .single()
      .throwOnError();
    expect((await staff.from("follow_ups").select("id").eq("id", data.id).throwOnError()).data).toHaveLength(1);
    expect((await staff.from("follow_ups").update({ done_at: new Date().toISOString() }).eq("id", data.id).select("id")).data).toEqual([]);
    expect((await staff.from("follow_ups").insert({ workspace_id: a.ws, request_id: a.request, kind: "custom", due_on: "2026-10-26", note: "x" })).error?.code).toBe("42501");
    expect((await other.from("follow_ups").select("id").eq("id", data.id).throwOnError()).data).toEqual([]);
    expect((await anon.from("follow_ups").select("id")).error?.code).toBe("42501");
  });

  it("hecho lo marca la base; no se mueve de solicitud ni cambia de tipo; a mano necesita nota", async () => {
    const { data } = await artist
      .from("follow_ups")
      .insert({ workspace_id: a.ws, request_id: a.request, kind: "custom", due_on: "2026-10-26", note: "Llamar" })
      .select("id")
      .single()
      .throwOnError();
    const { data: done } = await artist
      .from("follow_ups")
      .update({ done_at: "2000-01-01T00:00:00Z" })
      .eq("id", data.id)
      .select("done_at, done_by")
      .single()
      .throwOnError();
    expect(new Date(done.done_at!).getFullYear()).toBeGreaterThan(2000);
    expect(done.done_by).not.toBeNull();
    const { data: undone } = await artist.from("follow_ups").update({ done_at: null }).eq("id", data.id).select("done_by").single().throwOnError();
    expect(undone.done_by).toBeNull();

    expect((await admin.from("follow_ups").update({ kind: "touch_up" }).eq("id", data.id)).error?.code).toBe("23514");
    expect((await artist.from("follow_ups").insert({ workspace_id: a.ws, request_id: a.request, kind: "custom", due_on: "2026-10-26" })).error?.code).toBe("23514");
    expect((await admin.from("follow_ups").insert({ workspace_id: wsB, request_id: a.request, kind: "custom", due_on: "2026-10-26", note: "x" })).error?.code).toBe("23514");
  });

  it("solo el owner edita los cuidados", async () => {
    await owner.from("workspace_settings").update({ care_instructions: "Lavá con jabón neutro." }).eq("workspace_id", a.ws).throwOnError();
    const byArtist = await artist.from("workspace_settings").update({ care_instructions: "Otra cosa" }).eq("workspace_id", a.ws).select("workspace_id");
    expect(byArtist.data).toEqual([]);
    const { data } = await admin.from("workspace_settings").select("care_instructions").eq("workspace_id", a.ws).single().throwOnError();
    expect(data.care_instructions).toBe("Lavá con jabón neutro.");
  });
});
