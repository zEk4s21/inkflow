import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;

const options = { auth: { persistSession: false, autoRefreshToken: false } };

// Requiere Supabase local con las migraciones aplicadas (`pnpm db:start`).
describe.skipIf(!url || !publishableKey || !secretKey)("RLS de workspaces y perfiles", () => {
  const run = `${Date.now()}`;
  const password = "clave-de-prueba-larga-123";
  let admin: Client;
  let anon: Client;
  let ownerA: Client;
  let staffA: Client;
  let ownerB: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };
  const profile = { a: "", b: "" };

  async function createUser(label: string) {
    const email = `${label}-${run}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient<Database>(url!, publishableKey!, options);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return { id: data.user.id, client };
  }

  async function createWorkspace(slug: string, isPublic: boolean) {
    const { data, error } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single();
    if (error) throw error;
    await admin.from("workspace_settings").insert({ workspace_id: data.id }).throwOnError();
    const created = await admin
      .from("artist_profiles")
      .insert({ workspace_id: data.id, display_name: slug, is_public: isPublic })
      .select("id")
      .single()
      .throwOnError();
    return { workspaceId: data.id, profileId: created.data.id };
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);

    const a = await createWorkspace(`test-a-${run}`, true);
    const b = await createWorkspace(`test-b-${run}`, false);
    ws.a = a.workspaceId;
    ws.b = b.workspaceId;
    profile.a = a.profileId;
    profile.b = b.profileId;

    const owner1 = await createUser("owner-a");
    const staff1 = await createUser("staff-a");
    const owner2 = await createUser("owner-b");
    ownerA = owner1.client;
    staffA = staff1.client;
    ownerB = owner2.client;

    await admin
      .from("workspace_members")
      .insert([
        { workspace_id: ws.a, user_id: owner1.id, role: "owner" },
        { workspace_id: ws.a, user_id: staff1.id, role: "staff" },
        { workspace_id: ws.b, user_id: owner2.id, role: "owner" },
      ])
      .throwOnError();
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean));
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("anon ve solo workspaces con un perfil publicado", async () => {
    const { data } = await anon.from("workspaces").select("id").in("id", [ws.a, ws.b]);
    expect(data?.map((row) => row.id)).toEqual([ws.a]);
  });

  it("anon no ve columnas privadas del perfil", async () => {
    const { error } = await anon.from("artist_profiles").select("user_id").eq("id", profile.a);
    expect(error?.code).toBe("42501");
  });

  it("anon no puede escribir", async () => {
    const { error } = await anon.from("workspaces").insert({ slug: `anon-${run}`, name: "x" });
    expect(error).not.toBeNull();
    const update = await anon.from("artist_profiles").update({ bio: "hackeado" }).eq("id", profile.a).select();
    expect(update.data ?? []).toHaveLength(0);
  });

  it("un miembro no ve datos de otro workspace", async () => {
    const workspaces = await ownerB.from("workspaces").select("id").in("id", [ws.a, ws.b]);
    // ws.a es público, por eso lo ve; ws.b lo ve por ser miembro.
    expect(workspaces.data?.map((row) => row.id).sort()).toEqual([ws.a, ws.b].sort());

    const members = await ownerB.from("workspace_members").select("user_id").eq("workspace_id", ws.a);
    expect(members.data).toEqual([]);

    const hidden = await ownerA.from("artist_profiles").select("id").eq("id", profile.b);
    expect(hidden.data).toEqual([]);
  });

  it("solo el owner edita la configuración", async () => {
    const byStaff = await staffA
      .from("workspace_settings")
      .update({ location_label: "cambiado por staff" })
      .eq("workspace_id", ws.a)
      .select();
    expect(byStaff.data).toEqual([]);

    const byOwner = await ownerA
      .from("workspace_settings")
      .update({ location_label: "Banfield" })
      .eq("workspace_id", ws.a)
      .select("location_label");
    expect(byOwner.data).toEqual([{ location_label: "Banfield" }]);

    const otherTenant = await ownerB
      .from("workspace_settings")
      .update({ location_label: "intrusión" })
      .eq("workspace_id", ws.a)
      .select();
    expect(otherTenant.data).toEqual([]);
  });

  it("nadie se agrega como miembro ni cambia su rol", async () => {
    const insert = await ownerB
      .from("workspace_members")
      .insert({ workspace_id: ws.a, user_id: userIds[2], role: "owner" });
    expect(insert.error).not.toBeNull();

    const promote = await staffA.from("workspace_members").update({ role: "owner" }).eq("workspace_id", ws.a);
    expect(promote.error).not.toBeNull();
  });

  it("no se puede mover un perfil a otro workspace", async () => {
    const { error } = await ownerA.from("artist_profiles").update({ workspace_id: ws.b }).eq("id", profile.a);
    expect(error?.code).toBe("42501");
  });

  it("valida la zona horaria", async () => {
    const { error } = await ownerA
      .from("workspace_settings")
      .update({ timezone: "Marte/Olympus" })
      .eq("workspace_id", ws.a);
    expect(error?.code).toBe("23514");
  });
});
