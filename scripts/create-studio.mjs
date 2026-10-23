// Crea un estudio vacío (workspace, configuración y perfil sin publicar). Es el alta manual de
// producción: el seed de desarrollo no se aplica ahí.
// Uso: pnpm studio:create <slug> "<nombre del estudio>" "<nombre artístico>"
// Después: pnpm member:add <email> <slug> owner. El perfil se publica desde Ajustes.
// Usa SUPABASE_SECRET_KEY: correr solo desde una máquina de confianza.
import { createClient } from "@supabase/supabase-js";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const [slug, name, displayName] = process.argv.slice(2).map((arg) => arg?.trim());
if (!slug || !SLUG_PATTERN.test(slug) || !name || name.length > 80 || !displayName || displayName.length > 60) {
  console.error('Uso: pnpm studio:create <slug> "<nombre del estudio>" "<nombre artístico>"');
  console.error("El slug va en la URL (/artist/<slug>): minúsculas, números y guiones, de 3 a 40 caracteres.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (ver .env.example).");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const { data: existing, error: existingError } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
if (existingError) throw existingError;
if (existing) {
  console.error(`Ya existe un estudio con el slug "${slug}".`);
  process.exit(1);
}

const { data: workspace, error: workspaceError } = await admin
  .from("workspaces")
  .insert({ slug, name })
  .select("id")
  .single();
if (workspaceError) throw workspaceError;

// Si falla algo después, se borra el workspace (la cascada se lleva lo demás) para poder reintentar.
try {
  const { error: settingsError } = await admin.from("workspace_settings").insert({ workspace_id: workspace.id });
  if (settingsError) throw settingsError;
  const { error: profileError } = await admin
    .from("artist_profiles")
    .insert({ workspace_id: workspace.id, display_name: displayName, is_public: false });
  if (profileError) throw profileError;
} catch (error) {
  await admin.from("workspaces").delete().eq("id", workspace.id);
  throw error;
}

console.log(`Listo: estudio "${name}" (/artist/${slug}), sin publicar.`);
console.log(`Siguiente paso: pnpm member:add <email> ${slug} owner`);
