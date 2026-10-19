// Chequeo previo a producción: revisa las variables de entorno sin mostrar ningún valor.
// Uso: pnpm check:prod [archivo]
//   Sin archivo revisa las variables del entorno actual. Con Vercel:
//   vercel env pull .env.production.local --environment=production && pnpm check:prod .env.production.local
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { checkProductionEnv } from "./production-check.mjs";

const file = process.argv[2];
let env = process.env;
if (file) {
  try {
    env = parseEnv(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`No se pudo leer ${file}: ${error.code ?? error.message}`);
    process.exit(1);
  }
}

const { errors, warnings } = checkProductionEnv(env);
console.log(`Chequeo de producción${file ? ` (${file})` : ""}`);
for (const line of errors) console.log(`  ✗ ${line}`);
for (const line of warnings) console.log(`  ! ${line}`);
if (errors.length === 0) {
  console.log(warnings.length === 0 ? "  ✓ Todo listo." : "  ✓ Se puede salir; lo marcado con ! queda apagado.");
} else {
  console.log(`\n${errors.length} problema(s): corregilos antes de salir a producción.`);
  process.exit(1);
}
