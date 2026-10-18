import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseTstzRange } from "@/server/availability/schemas";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const monday = { weekday: 1, start_time: "10:00", end_time: "18:00", slot_minutes: 180, buffer_minutes: 30 };

describe.skipIf(!url || !publishableKey || !secretKey)("RLS de horarios y bloqueos", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let ownerA: Client;
  let staffA: Client;
  let ownerB: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };
  const artist = { a: "", b: "" };

  async function workspace(slug: string, timezone: string) {
    const { data } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
    await admin.from("workspace_settings").insert({ workspace_id: data.id, timezone }).throwOnError();
    const { data: profile } = await admin
      .from("artist_profiles")
      .insert({ workspace_id: data.id, display_name: slug, is_public: true })
      .select("id")
      .single()
      .throwOnError();
    return { id: data.id, artistId: profile.id };
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

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    const a = await workspace(`agea-${run}`, "America/Argentina/Buenos_Aires");
    const b = await workspace(`ageb-${run}`, "Europe/Madrid");
    Object.assign(ws, { a: a.id, b: b.id });
    Object.assign(artist, { a: a.artistId, b: b.artistId });
    ownerA = await user("owner-age", ws.a, "owner");
    staffA = await user("staff-age", ws.a, "staff");
    ownerB = await user("owner-ageb", ws.b, "owner");
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("el owner reemplaza el horario semanal completo", async () => {
    await ownerA.rpc("set_weekly_availability", { target_artist: artist.a, rules: [monday, { ...monday, weekday: 3 }] }).throwOnError();
    await ownerA.rpc("set_weekly_availability", { target_artist: artist.a, rules: [{ ...monday, weekday: 5 }] }).throwOnError();
    const { data } = await ownerA.from("availability_rules").select("weekday").eq("artist_id", artist.a).throwOnError();
    expect(data).toEqual([{ weekday: 5 }]);
  });

  it("rechaza franjas superpuestas o invertidas sin tocar el horario anterior", async () => {
    const overlap = await ownerA.rpc("set_weekly_availability", {
      target_artist: artist.a,
      rules: [monday, { ...monday, start_time: "17:00", end_time: "20:00" }],
    });
    expect(overlap.error).not.toBeNull();
    const inverted = await ownerA.rpc("set_weekly_availability", { target_artist: artist.a, rules: [{ ...monday, end_time: "09:00" }] });
    expect(inverted.error).not.toBeNull();
    const { data } = await ownerA.from("availability_rules").select("weekday").eq("artist_id", artist.a).throwOnError();
    expect(data).toEqual([{ weekday: 5 }]);
  });

  it("staff, otros estudios y anon no cambian horarios ni bloqueos", async () => {
    expect((await staffA.rpc("set_weekly_availability", { target_artist: artist.a, rules: [] })).error).not.toBeNull();
    expect((await ownerB.rpc("set_weekly_availability", { target_artist: artist.a, rules: [] })).error).not.toBeNull();
    expect((await anon.rpc("set_weekly_availability", { target_artist: artist.a, rules: [] })).error).not.toBeNull();
    const block = { target_artist: artist.a, start_date: "2026-12-24", end_date: "2026-12-25" };
    expect((await staffA.rpc("add_availability_block", block)).error).not.toBeNull();
    expect((await ownerB.rpc("add_availability_block", block)).error).not.toBeNull();
    expect((await anon.from("availability_rules").select("id")).error).not.toBeNull();
    const { data } = await ownerB.from("availability_rules").select("id").eq("artist_id", artist.a).throwOnError();
    expect(data).toHaveLength(0);
    // Staff lee pero no borra.
    expect((await staffA.from("availability_rules").select("id").eq("artist_id", artist.a)).data).toHaveLength(1);
    const del = await staffA.from("availability_rules").delete().eq("artist_id", artist.a).select("id");
    expect(del.data ?? []).toHaveLength(0);
  });

  it("los bloqueos de días completos usan la zona horaria del estudio", async () => {
    const { data: id } = await ownerA
      .rpc("add_availability_block", { target_artist: artist.a, start_date: "2026-12-24", end_date: "2026-12-25", reason: "Fiestas" })
      .throwOnError();
    const { data } = await ownerA.from("availability_blocks").select("period, reason").eq("id", id).single().throwOnError();
    const period = parseTstzRange(data.period as string);
    expect(period?.start.toISOString()).toBe("2026-12-24T03:00:00.000Z");
    expect(period?.end.toISOString()).toBe("2026-12-26T03:00:00.000Z");
    expect(data.reason).toBe("Fiestas");

    const { data: madridId } = await ownerB
      .rpc("add_availability_block", { target_artist: artist.b, start_date: "2026-07-01", end_date: "2026-07-01", start_time: "10:00", end_time: "12:30" })
      .throwOnError();
    const { data: madrid } = await ownerB.from("availability_blocks").select("period").eq("id", madridId).single().throwOnError();
    const madridPeriod = parseTstzRange(madrid.period as string);
    expect(madridPeriod?.start.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(madridPeriod?.end.toISOString()).toBe("2026-07-01T10:30:00.000Z");
  });

  it("no se puede cargar un bloqueo invertido ni para el tatuador de otro estudio", async () => {
    const inverted = await ownerA.rpc("add_availability_block", {
      target_artist: artist.a,
      start_date: "2026-12-24",
      end_date: "2026-12-24",
      start_time: "15:00",
      end_time: "10:00",
    });
    expect(inverted.error).not.toBeNull();
    const cross = await ownerA.from("availability_blocks").insert({ workspace_id: ws.a, artist_id: artist.b, period: "[2026-12-01,2026-12-02)" });
    expect(cross.error).not.toBeNull();
  });
});
