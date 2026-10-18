// Da acceso al panel: crea la cuenta (si no existe) y la suma a un workspace.
// Uso: pnpm member:add <email> <slug-del-workspace> [owner|artist|staff]
// Usa SUPABASE_SECRET_KEY: correr solo desde una máquina de confianza.
import { createClient } from "@supabase/supabase-js";

const [email, slug, role = "owner"] = process.argv.slice(2);
if (!email || !slug || !["owner", "artist", "staff"].includes(role)) {
  console.error("Uso: pnpm member:add <email> <slug-del-workspace> [owner|artist|staff]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (ver .env.example).");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const { data: workspace, error: workspaceError } = await admin
  .from("workspaces")
  .select("id, name")
  .eq("slug", slug)
  .is("deleted_at", null)
  .maybeSingle();
if (workspaceError) throw workspaceError;
if (!workspace) {
  console.error(`No existe el workspace "${slug}".`);
  process.exit(1);
}

const normalized = email.trim().toLowerCase();
let userId;
const created = await admin.auth.admin.createUser({ email: normalized, email_confirm: true });
if (created.data.user) {
  userId = created.data.user.id;
} else if (created.error?.code === "email_exists") {
  // listUsers no filtra por email: se recorre por páginas.
  for (let page = 1; !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((user) => user.email === normalized)?.id;
    if (data.users.length < 200) break;
  }
} else {
  throw created.error;
}
if (!userId) throw new Error("No se encontró la cuenta recién creada.");

const { error } = await admin
  .from("workspace_members")
  .upsert({ workspace_id: workspace.id, user_id: userId, role }, { onConflict: "workspace_id,user_id" });
if (error) throw error;

console.log(`${normalized} ahora es ${role} de "${workspace.name}". Ya puede entrar desde /ingresar.`);
