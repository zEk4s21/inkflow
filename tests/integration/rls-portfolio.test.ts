import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
// PNG de 1x1 píxel.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe.skipIf(!url || !publishableKey || !secretKey)("RLS del portfolio y Storage", () => {
  const run = `${Date.now()}`;
  let admin: Client;
  let anon: Client;
  let ownerA: Client;
  let staffA: Client;
  let ownerB: Client;
  const userIds: string[] = [];
  const ws = { a: "", b: "" };

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

  async function workspace(slug: string) {
    const { data } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
    await admin.from("workspace_settings").insert({ workspace_id: data.id }).throwOnError();
    await admin.from("artist_profiles").insert({ workspace_id: data.id, display_name: slug, is_public: true }).throwOnError();
    return data.id;
  }

  const item = (workspaceId: string, file: string, status: "draft" | "published") => ({
    workspace_id: workspaceId,
    title: `Trabajo ${file}`,
    category: "Prueba",
    status,
    image_path: `${workspaceId}/${file}`,
    image_width: 1,
    image_height: 1,
    alt_text: "Foto de prueba",
  });

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, options);
    anon = createClient<Database>(url!, publishableKey!, options);
    ws.a = await workspace(`porta-${run}`);
    ws.b = await workspace(`portb-${run}`);
    ownerA = await user("owner-a", ws.a, "owner");
    staffA = await user("staff-a", ws.a, "staff");
    ownerB = await user("owner-b", ws.b, "owner");
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of [ws.a, ws.b].filter(Boolean)) {
      const { data } = await admin.storage.from("portfolio").list(id);
      if (data?.length) await admin.storage.from("portfolio").remove(data.map((file) => `${id}/${file.name}`));
    }
    await admin.from("workspaces").delete().in("id", [ws.a, ws.b].filter(Boolean));
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("el owner sube fotos solo a la carpeta de su workspace", async () => {
    const own = await ownerA.storage.from("portfolio").upload(`${ws.a}/foto-${run}.png`, PNG, { contentType: "image/png" });
    expect(own.error).toBeNull();
    const other = await ownerA.storage.from("portfolio").upload(`${ws.b}/intruso-${run}.png`, PNG, { contentType: "image/png" });
    expect(other.error).not.toBeNull();
    const noFolder = await ownerA.storage.from("portfolio").upload(`suelto-${run}.png`, PNG, { contentType: "image/png" });
    expect(noFolder.error).not.toBeNull();
  });

  it("staff no sube fotos ni carga trabajos", async () => {
    const upload = await staffA.storage.from("portfolio").upload(`${ws.a}/staff-${run}.png`, PNG, { contentType: "image/png" });
    expect(upload.error).not.toBeNull();
    const insert = await staffA.from("portfolio_items").insert(item(ws.a, `staff-${run}.png`, "draft"));
    expect(insert.error).not.toBeNull();
  });

  it("no se puede apuntar a una foto de otro workspace", async () => {
    const { error } = await ownerA.from("portfolio_items").insert({ ...item(ws.a, "x.png", "draft"), image_path: `${ws.b}/x.png` });
    expect(error?.code).toBe("23514");
  });

  it("anon ve solo trabajos publicados", async () => {
    await ownerA.from("portfolio_items").insert([item(ws.a, `pub-${run}.png`, "published"), item(ws.a, `draft-${run}.png`, "draft")]).throwOnError();
    const { data } = await anon.from("portfolio_items").select("title").eq("workspace_id", ws.a);
    expect(data?.map((row) => row.title)).toEqual([`Trabajo pub-${run}.png`]);
  });

  it("otro workspace no ve borradores ni edita trabajos ajenos", async () => {
    const seen = await ownerB.from("portfolio_items").select("status").eq("workspace_id", ws.a);
    expect(seen.data?.every((row) => row.status === "published")).toBe(true);
    const edit = await ownerB.from("portfolio_items").update({ title: "hackeado" }).eq("workspace_id", ws.a).select();
    expect(edit.data).toEqual([]);
    const remove = await ownerB.storage.from("portfolio").remove([`${ws.a}/foto-${run}.png`]);
    expect(remove.data).toEqual([]);
  });
});
