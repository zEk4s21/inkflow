import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
type Insert = Database["public"]["Tables"]["appointments"]["Insert"];
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const HOUR = 3_600_000;

describe.skipIf(!url || !publishableKey || !secretKey)("Gestión de turnos: permisos, estados y concurrencia", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let owner: Client;
  let artist: Client;
  let staff: Client;
  let otherOwner: Client;
  const userIds: string[] = [];
  const a = { ws: "", artist: "", client: "" };
  const b = { ws: "" };
  // Cada test usa su propio día, lejos en el futuro, para que los turnos no se crucen entre tests.
  let day = 0;
  const nextDay = () => new Date(Date.UTC(2031, 0, 1) + day++ * 24 * HOUR);
  const range = (start: Date, hours: number) => `[${start.toISOString()},${new Date(start.getTime() + hours * HOUR).toISOString()})`;

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

  const base = (overrides: Partial<Insert> = {}): Insert => ({
    workspace_id: a.ws,
    artist_id: a.artist,
    client_id: a.client,
    period: range(nextDay(), 3),
    buffer_minutes: 30,
    ...overrides,
  });

  /** Turno creado con la clave secreta, como lo deja el formulario público o un test. */
  async function seed(overrides: Partial<Insert> = {}) {
    const { data } = await admin.from("appointments").insert(base(overrides)).select("id").single().throwOnError();
    return data.id;
  }

  async function statusOf(id: string) {
    const { data } = await admin.from("appointments").select("status").eq("id", id).single().throwOnError();
    return data.status;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    const { data: wsA } = await admin.from("workspaces").insert({ slug: `gesa-${run}`, name: "A" }).select("id").single().throwOnError();
    const { data: wsB } = await admin.from("workspaces").insert({ slug: `gesb-${run}`, name: "B" }).select("id").single().throwOnError();
    a.ws = wsA.id;
    b.ws = wsB.id;
    const { data: profile } = await admin
      .from("artist_profiles")
      .insert({ workspace_id: a.ws, display_name: "A", is_public: true })
      .select("id")
      .single()
      .throwOnError();
    a.artist = profile.id;
    const { data: client } = await admin
      .from("clients")
      .insert({ workspace_id: a.ws, name: "Ana", email: `ana-${run}@example.com` })
      .select("id")
      .single()
      .throwOnError();
    a.client = client.id;
    owner = await user("owner-ges", a.ws, "owner");
    artist = await user("artist-ges", a.ws, "artist");
    staff = await user("staff-ges", a.ws, "staff");
    otherOwner = await user("owner-gesb", b.ws, "owner");
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [a.ws, b.ws].filter(Boolean)).throwOnError();
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("owner o artista dan turnos a mano; staff y otros estudios no", async () => {
    await owner.from("appointments").insert(base({ source: "manual", status: "confirmed" })).throwOnError();
    await artist.from("appointments").insert(base({ source: "manual", status: "confirmed" })).throwOnError();
    expect((await staff.from("appointments").insert(base({ source: "manual" }))).error?.code).toBe("42501");
    // Otro estudio ni siquiera ve al cliente: lo frena el trigger de consistencia antes que la RLS.
    expect(["42501", "23514"]).toContain((await otherOwner.from("appointments").insert(base({ source: "manual" }))).error?.code);
    // Un turno "del formulario" o ya cerrado no se inventa desde el panel.
    expect((await owner.from("appointments").insert(base({ source: "form" }))).error?.code).toBe("42501");
    expect((await owner.from("appointments").insert(base({ source: "manual", status: "completed" }))).error?.code).toBe("42501");
  });

  it("staff y otros estudios no cambian turnos, y nadie los mueve de cliente", async () => {
    const id = await seed();
    const byStaff = await staff.from("appointments").update({ status: "confirmed" }).eq("id", id).select("id");
    expect(byStaff.data).toEqual([]);
    const byOther = await otherOwner.from("appointments").update({ status: "confirmed" }).eq("id", id).select("id");
    expect(byOther.data).toEqual([]);
    const moved = await owner.from("appointments").update({ client_id: a.client }).eq("id", id);
    expect(moved.error?.code).toBe("42501");
    expect(await statusOf(id)).toBe("requested");
  });

  it("solo deja pasar cambios de estado válidos", async () => {
    const requested = await seed();
    expect((await owner.from("appointments").update({ status: "completed" }).eq("id", requested)).error?.code).toBe("23514");
    await owner.from("appointments").update({ status: "confirmed" }).eq("id", requested).throwOnError();
    expect((await owner.from("appointments").update({ status: "requested" }).eq("id", requested)).error?.code).toBe("23514");
    // Todavía no empezó: no se puede marcar como realizado.
    expect((await owner.from("appointments").update({ status: "completed" }).eq("id", requested)).error?.code).toBe("23514");
    await owner.from("appointments").update({ status: "cancelled" }).eq("id", requested).throwOnError();
    // Cancelado es final: ni se reabre ni se reprograma.
    expect((await owner.from("appointments").update({ status: "confirmed" }).eq("id", requested)).error?.code).toBe("23514");
    expect((await owner.from("appointments").update({ period: range(nextDay(), 2) }).eq("id", requested)).error?.code).toBe("23514");

    const past = await seed({ status: "confirmed", period: range(new Date(Date.now() - 48 * HOUR), 3) });
    await artist.from("appointments").update({ status: "no_show" }).eq("id", past).throwOnError();
    expect(await statusOf(past)).toBe("no_show");
  });

  it("reprogramar un confirmado encima de otro confirmado falla; un pedido sí puede coincidir", async () => {
    const start = nextDay();
    await seed({ status: "confirmed", period: range(start, 3) });
    const other = await seed({ status: "confirmed", period: range(new Date(start.getTime() + 6 * HOUR), 2) });
    // 3h15 después del inicio: cae dentro del margen de 30 minutos del primero.
    const clash = await owner
      .from("appointments")
      .update({ period: range(new Date(start.getTime() + 3.25 * HOUR), 2) })
      .eq("id", other);
    expect(clash.error?.code).toBe("23P01");
    const requested = await seed();
    await owner.from("appointments").update({ period: range(start, 3) }).eq("id", requested).throwOnError();
  });

  it("si varios confirman a la vez turnos que se pisan, queda uno solo confirmado", async () => {
    const start = nextDay();
    // Seis pedidos para el mismo horario, apenas corridos, confirmados en paralelo por dos personas.
    const ids = await Promise.all(
      Array.from({ length: 6 }, (_, index) => seed({ period: range(new Date(start.getTime() + index * 15 * 60_000), 3) })),
    );
    const results = await Promise.all(
      ids.map((id, index) => (index % 2 === 0 ? owner : artist).from("appointments").update({ status: "confirmed" }).eq("id", id).select("id")),
    );
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.filter((result) => result.error).every((result) => result.error?.code === "23P01")).toBe(true);
    const { data } = await admin.from("appointments").select("id").in("id", ids).eq("status", "confirmed").throwOnError();
    expect(data).toHaveLength(1);
  });
});
