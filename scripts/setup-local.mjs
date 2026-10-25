// Prepara INKFLOW para verlo en tu compu con un solo comando (solo desarrollo local).
// Uso: pnpm local:setup [tu-email]
//
// 1. Levanta Supabase local en Docker (la primera vez descarga imágenes y tarda unos minutos).
// 2. Escribe .env.local con la URL y las claves locales, sin tocar lo que ya tengas cargado.
// 3. Si pasás un email, le da acceso al panel del estudio "esti" como owner.
// 4. Si hay fotos en public/demo, carga el portfolio de ejemplo.
// Después: pnpm dev y abrí http://localhost:3000/artist/esti
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENV_FILE = ".env.local";
const email = process.argv[2];

function step(message) {
  console.log(`\n→ ${message}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\nFalló: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

step("Levantando la base de datos local (Supabase en Docker)…");
run("pnpm", ["exec", "supabase", "start"]);

// Si la base ya existía, `supabase start` no aplica las migraciones nuevas de cada fase.
step("Aplicando las migraciones pendientes…");
run("pnpm", ["exec", "supabase", "migration", "up", "--local"]);

step(`Escribiendo ${ENV_FILE}…`);
const status = JSON.parse(execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], { encoding: "utf8" }));
const local = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  // Sin claves de Cloudflare, en local el formulario funciona sin captcha.
  INKFLOW_ALLOW_NO_CAPTCHA: "1",
};
if (Object.values(local).some((value) => !value)) {
  console.error("Supabase no devolvió la URL o las claves. Revisá que Docker esté abierto y probá de nuevo.");
  process.exit(1);
}
// Se reemplazan solo estas variables; el resto (por ejemplo AI_API_KEY) queda como estaba.
const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split("\n") : [];
const kept = lines.filter((line) => !Object.keys(local).some((key) => line.startsWith(`${key}=`)));
while (kept.length && kept.at(-1) === "") kept.pop();
const content = [...kept, ...Object.entries(local).map(([key, value]) => `${key}=${value}`)].join("\n") + "\n";
writeFileSync(ENV_FILE, content, { mode: 0o600 });

if (email) {
  step(`Dando acceso al panel a ${email}…`);
  run("node", [`--env-file=${ENV_FILE}`, "scripts/add-member.mjs", email, "esti", "owner"]);
}

const admin = createClient(local.NEXT_PUBLIC_SUPABASE_URL, local.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { count } = await admin
  .from("portfolio_items")
  .select("id, workspaces!inner (slug)", { count: "exact", head: true })
  .eq("workspaces.slug", "esti");
if (count) {
  console.log(`\n(El portfolio ya tiene ${count} trabajos: no se vuelve a cargar.)`);
} else if (existsSync("public/demo") && readdirSync("public/demo").some((file) => file.endsWith(".jpg"))) {
  step("Cargando el portfolio de ejemplo…");
  run("node", [`--env-file=${ENV_FILE}`, "scripts/seed-demo-portfolio.mjs"]);
} else {
  console.log("\n(No hay fotos en public/demo: el portfolio queda vacío.)");
}

console.log(`
Listo. Ahora corré:  pnpm dev
  Página pública:  http://localhost:3000/artist/esti
  Panel:           http://localhost:3000/ingresar${email ? ` (con ${email})` : ""}
  Emails de login: http://127.0.0.1:54324
Para apagar la base: pnpm db:stop`);
