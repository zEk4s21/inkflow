# INKFLOW

Plataforma web para tatuadores: página pública con portfolio, consultas, asistente de IA, solicitudes, clientes y turnos.
Arranca como microapp para un tatuador y está preparada para funcionar como SaaS multi-tatuador.

> Estado: **Fases 0 a 5 completas en código** (página pública, consultas, asistente, turnos, presupuestos, pagos manuales, link para el cliente, controles y emails). Falta la puesta en producción (Fase 6) y conectar los servicios externos: IA, captcha y email funcionan en modo "no configurado" hasta cargar sus claves. Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## Tecnologías

| Capa | Herramienta |
|---|---|
| App | Next.js 16 (App Router, Server Actions), React 19, TypeScript 5.9 |
| Estilos | Tailwind CSS 4 |
| Datos, auth y archivos | Supabase (Postgres con RLS, Auth, Storage) |
| Validación | zod 4 |
| Tests | Vitest (unit + integración), Playwright (E2E móvil y desktop) |
| Hosting previsto | Vercel + Supabase |

## Requisitos

- Node.js 22 o superior
- pnpm 10 (`corepack enable`)
- Docker (solo para la base de datos local)

## Instalación y ejecución local

```bash
pnpm install
cp .env.example .env.local
pnpm db:start        # levanta Supabase local e imprime URL y claves
# completá .env.local con API URL, Publishable key y Secret key
pnpm dev             # http://localhost:3000
```

Para frenar la base: `pnpm db:stop`.

### Atajo: todo con un comando

Con Docker abierto:

```bash
pnpm install
pnpm local:setup vos@example.com   # el email es opcional: te da acceso al panel de "esti"
pnpm dev
```

`local:setup` levanta Supabase local, escribe en `.env.local` la URL y las claves locales (respeta el resto
de las variables que ya tengas, como `AI_API_KEY`), habilita el formulario sin captcha (solo local), da acceso
al panel si pasás un email y carga el portfolio de ejemplo si hay fotos en `public/demo/` (no se versionan).
Se puede correr de nuevo sin romper nada. El link para entrar al panel llega a Mailpit: http://127.0.0.1:54324.

## Configuración

Todas las variables están documentadas en [.env.example](.env.example). La app valida las variables al usarlas y falla con un mensaje que indica cuál falta.

- `NEXT_PUBLIC_*` llegan al navegador. Nunca pongas un secreto con ese prefijo.
- `SUPABASE_SECRET_KEY` saltea RLS: se usa solo en código de servidor (`src/server`).
- Emails: sin `EMAIL_API_KEY` y `EMAIL_FROM` no se manda ninguno (Ajustes lo muestra como "No configurado"). Con Resend, `EMAIL_FROM` tiene que ser de un dominio verificado.
- El formulario de consulta usa Cloudflare Turnstile. En local podés usar las claves de prueba de Cloudflare (están en `.env.example`) o `INKFLOW_ALLOW_NO_CAPTCHA=1`, que lo deja sin captcha. Esa variable **nunca** va en producción; sin claves, el formulario se muestra como no disponible.

El registro público de cuentas está **desactivado** (`supabase/config.toml`). Las cuentas de tatuadores se crean por invitación.

## Dar acceso al panel

```bash
pnpm member:add <email> <slug-del-workspace> [owner|artist|staff]
# ej. en local, con el seed: pnpm member:add vos@example.com esti owner
```

Después esa persona entra en `/ingresar` con su email y recibe un link (en local, los emails se ven en http://127.0.0.1:54324). El script usa `SUPABASE_SECRET_KEY` de `.env.local`.

## Testing

```bash
pnpm lint
pnpm typecheck
pnpm test            # unit; los de integración se saltean si no hay Supabase configurado
pnpm build && pnpm e2e
```

Tests de integración contra la base local:

```bash
pnpm db:start
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key local> \
pnpm test
```

Si Playwright no puede descargar browsers, usá uno instalado con `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chrome pnpm e2e`.

CI (GitHub Actions) corre lint, typecheck, unit, build, E2E y los tests de integración con Supabase local en cada PR.

## Despliegue

Paso a paso en [docs/DEPLOY.md](docs/DEPLOY.md):
- Supabase en São Paulo y Vercel.
- Migraciones con el workflow manual "Base de producción", nunca a mano.
- Alta del estudio con `pnpm studio:create` y `pnpm member:add`.
- Chequeo previo con `pnpm check:prod`, que revisa las variables sin mostrar valores.

En el deploy de producción de Vercel (`VERCEL_ENV=production`) la app ignora los modos de prueba (`INKFLOW_ALLOW_NO_CAPTCHA`, IA simulada).

Los textos legales están en [docs/legal](docs/legal/) como **borradores para revisión legal**: todavía no se publican en la app.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Seguridad](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)
- [Despliegue](docs/DEPLOY.md)
- [Textos legales (borradores)](docs/legal/README.md)
