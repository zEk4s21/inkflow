import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "../../src/types/database.types";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const secretKey = process.env.SUPABASE_SECRET_KEY;
export const hasDatabase = Boolean(supabaseUrl && secretKey);

export function adminClient() {
  return createClient<Database>(supabaseUrl!, secretKey!, { auth: { persistSession: false } });
}

/** Link de ingreso como el del email, generado sin pasar por el correo. */
export async function magicLinkFor(email: string) {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`;
}

export async function signIn(page: Page, email: string) {
  await page.goto(await magicLinkFor(email));
  await page.waitForURL(/\/panel$/);
}

// PNG de 1x1 píxel para fixtures.
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

type FixtureWork = { title: string; category: string; status?: "draft" | "published" };

/**
 * Estudio de prueba aislado: workspace público, perfil, trabajos y (opcional) un usuario miembro.
 * Así los tests no dependen del seed ni se pisan entre sí.
 */
export async function createStudio(label: string, options: { role?: "owner" | "artist" | "staff"; works?: FixtureWork[] } = {}) {
  const admin = adminClient();
  const slug = `e2e-${label}-${Date.now()}`.toLowerCase().slice(0, 40).replace(/-$/, "");
  const { data: workspace } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
  await admin.from("workspace_settings").insert({ workspace_id: workspace.id }).throwOnError();
  await admin.from("artist_profiles").insert({ workspace_id: workspace.id, display_name: "Prueba", is_public: true }).throwOnError();

  const workIds: string[] = [];
  for (const [position, work] of (options.works ?? []).entries()) {
    const path = `${workspace.id}/${crypto.randomUUID()}.png`;
    const upload = await admin.storage.from("portfolio").upload(path, TINY_PNG, { contentType: "image/png" });
    if (upload.error) throw upload.error;
    const { data } = await admin
      .from("portfolio_items")
      .insert({
        workspace_id: workspace.id,
        title: work.title,
        category: work.category,
        status: work.status ?? "published",
        position,
        image_path: path,
        image_width: 800,
        image_height: 1000,
        alt_text: work.title,
      })
      .select("id")
      .single()
      .throwOnError();
    workIds.push(data.id);
  }

  let userId: string | undefined;
  const email = `${slug}@example.com`;
  if (options.role) {
    const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
    userId = data.user!.id;
    await admin.from("workspace_members").insert({ workspace_id: workspace.id, user_id: userId, role: options.role }).throwOnError();
  }

  return {
    slug,
    email,
    workspaceId: workspace.id,
    workIds,
    async storageFiles() {
      const { data } = await admin.storage.from("portfolio").list(workspace.id);
      return data ?? [];
    },
    async cleanup() {
      const files = await this.storageFiles();
      if (files.length) await admin.storage.from("portfolio").remove(files.map((file) => `${workspace.id}/${file.name}`));
      await admin.from("workspaces").delete().eq("id", workspace.id);
      if (userId) await admin.auth.admin.deleteUser(userId);
    },
  };
}
