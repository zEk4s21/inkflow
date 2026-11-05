// Conecta la cuenta de Instagram de un estudio para que su portfolio salga de ahí.
// Uso: pnpm instagram:connect <slug> <token>
// El token es el que genera Meta for Developers > tu app > Instagram > "API setup with
// Instagram login" > Generate access tokens (dura 60 días; INKFLOW lo renueva solo).
// Usa SUPABASE_SECRET_KEY: correr solo desde una máquina de confianza.
import { createClient } from "@supabase/supabase-js";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const TOKEN_LIFETIME_DAYS = 59;
const [slug, token] = process.argv.slice(2).map((arg) => arg?.trim());
if (!slug || !SLUG_PATTERN.test(slug) || !token || token.length < 20) {
  console.error("Uso: pnpm instagram:connect <slug> <token>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (ver .env.example).");
  process.exit(1);
}

// Antes de guardarlo se prueba contra Instagram, así no queda un token que no sirve.
const me = await fetch(`https://graph.instagram.com/me?fields=username,account_type&access_token=${encodeURIComponent(token)}`);
if (!me.ok) {
  console.error(`Instagram rechazó el token (${me.status}). Generá uno nuevo y volvé a probar.`);
  process.exit(1);
}
const { username, account_type: accountType } = await me.json();

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const { data: workspace, error: workspaceError } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
if (workspaceError) throw workspaceError;
if (!workspace) {
  console.error(`No existe un estudio con el slug "${slug}".`);
  process.exit(1);
}

const now = Date.now();
const { error } = await admin.from("instagram_connections").upsert({
  workspace_id: workspace.id,
  access_token: token,
  expires_at: new Date(now + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  refreshed_at: new Date(now).toISOString(),
});
if (error) throw error;

console.log(`Listo: /artist/${slug} muestra las publicaciones de @${username}${accountType ? ` (${accountType})` : ""}.`);
console.log("Puede tardar hasta una hora en verse, o al instante si reiniciás el servidor.");
