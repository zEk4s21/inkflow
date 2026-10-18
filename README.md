# INKFLOW

Plataforma web para tatuadores: página pública con portfolio, consultas, asistente de IA, solicitudes, clientes y turnos.
Arranca como microapp para un tatuador y está preparada para funcionar como SaaS multi-tatuador.

> Estado: **Fase 0 completa** (base técnica). Todavía no hay funciones de producto. Ver [docs/ROADMAP.md](docs/ROADMAP.md).

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

## Configuración

Todas las variables están documentadas en [.env.example](.env.example). La app valida las variables al usarlas y falla con un mensaje que indica cuál falta.

- `NEXT_PUBLIC_*` llegan al navegador. Nunca pongas un secreto con ese prefijo.
- `SUPABASE_SECRET_KEY` saltea RLS: se usa solo en código de servidor (`src/server`).

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

Pendiente (se documenta al cerrar la Fase 1). Plan: proyecto Supabase en la región São Paulo, app en Vercel y migraciones aplicadas con `supabase db push` desde CI, nunca a mano.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Seguridad](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)
