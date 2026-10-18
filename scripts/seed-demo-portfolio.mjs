// Carga trabajos de ejemplo en un workspace (solo para desarrollo local).
// Uso: pnpm db:seed-portfolio [carpeta-con-fotos] [slug]
// Por defecto lee public/demo/*.jpg (no versionado) y usa el workspace "esti".
// Las fotos son recortes de capturas de Instagram de @tattoobyesti: provisorias.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [folder = "public/demo", slug = "esti"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (ver .env.example).");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  console.error("Este script es solo para la base local.");
  process.exit(1);
}

const WORKS = [
  ["cristo-antebrazo", "Cristo con corona de espinas", "Religioso", "Antebrazo", "Rostro de Cristo con corona de espinas y manos en oración, en negro y gris."],
  ["japones-paisaje", "Paisaje japonés con torii", "Oriental", "Brazo", "Paisaje con torii, montañas y una figura meditando junto al agua."],
  ["virgen-rosario", "Virgen con rosario", "Religioso", "Brazo", "Virgen con lágrima y rosario entre las manos."],
  ["caballero-espalda", "Caballero en armadura", "Figurativo", "Espalda", "Caballero medieval sentado con armadura detallada, en proceso."],
  ["tigre", "Tigre", "Animales", "Antebrazo", "Tigre rugiendo de frente, en negro y gris."],
  ["buda", "Buda", "Oriental", "Brazo", "Rostro de Buda sereno con símbolo om y fondo de puntillismo."],
  ["virgen-rostro", "Virgen", "Religioso", "Brazo", "Rostro de virgen con manto, mirando hacia arriba."],
  ["pagoda-antebrazo", "Pagoda", "Oriental", "Antebrazo", "Pagoda japonesa entre pinos y nubes."],
  ["ojo-mano", "Mirada entre los dedos", "Figurativo", null, "Ojo que asoma entre los dedos de una mano con una cruz."],
  ["virgen-brazo", "Virgen dolorosa", "Religioso", "Brazo", "Virgen con corona de espinas sosteniendo un rosario."],
  ["angel-brazo", "Ángel", "Religioso", "Brazo", "Figura de ángel con alas en una manga en negro y gris."],
];

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const { data: workspace } = await admin.from("workspaces").select("id").eq("slug", slug).single().throwOnError();

let loaded = 0;
for (const [index, [file, title, category, bodyZone, alt]] of WORKS.entries()) {
  let bytes;
  try {
    bytes = await readFile(join(folder, `${file}.jpg`));
  } catch {
    console.warn(`Falta ${file}.jpg, se saltea.`);
    continue;
  }
  const path = `${workspace.id}/${randomUUID()}.jpg`;
  const upload = await admin.storage.from("portfolio").upload(path, bytes, { contentType: "image/jpeg" });
  if (upload.error) throw upload.error;
  await admin
    .from("portfolio_items")
    .insert({
      workspace_id: workspace.id,
      title,
      category,
      body_zone: bodyZone,
      alt_text: alt,
      status: "published",
      position: index,
      image_path: path,
      // Los recortes demo son 4:5.
      image_width: 800,
      image_height: 1000,
    })
    .throwOnError();
  loaded++;
}
console.log(`${loaded} trabajos cargados en "${slug}".`);
