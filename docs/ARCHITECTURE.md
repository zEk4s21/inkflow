# Arquitectura

## Visión general

```
Navegador ──► Next.js (Vercel)
               ├─ src/app                 rutas y UI (Server Components por defecto)
               ├─ Server Actions / Route Handlers   ← único punto de entrada de escrituras
               │     valida con zod → verifica sesión y permisos → llama a src/server/services
               ├─ src/server/services     reglas de negocio, testeables sin Next
               ├─ src/server/repositories acceso a datos con la sesión del usuario
               └─ src/server/integrations IA, email, captcha, storage
                         │
                         ▼
               Supabase: Postgres (RLS) · Auth · Storage
```

## Módulos

| Carpeta | Contenido | Estado |
|---|---|---|
| `src/app` | Rutas, layouts y páginas | Base |
| `src/components/ui` | Primitivas del sistema de diseño | Fase 1 |
| `src/config` | `regional.ts` (idioma, moneda, zona horaria) y `env.ts` (validación de variables públicas) | Hecho |
| `src/lib` | `format.ts` (único formateo de dinero y fechas), cliente Supabase de navegador | Hecho |
| `src/server` | Código solo de servidor (`import "server-only"`): env secreta, cliente Supabase con sesión | Base |
| `supabase/` | `config.toml`, migraciones SQL versionadas, seed | Base |
| `tests/` | `unit`, `integration`, `e2e` | Base |

## Decisiones técnicas

| # | Decisión | Motivo |
|---|---|---|
| D1 | El tenant es `workspace`, no el tatuador | Hoy es 1 a 1. Cuando lleguen los estudios (N tatuadores) no hay que migrar datos. |
| D2 | Doble barrera de autorización: servidor + RLS | Si una Server Action tiene un bug, Postgres igual rechaza filas de otro workspace. |
| D3 | Sin ORM | La seguridad vive en RLS. Un ORM con conexión directa la saltearía. Se usan tipos generados por el CLI de Supabase. |
| D4 | Escrituras públicas vía función `SECURITY DEFINER` acotada | Los visitantes no tienen cuenta; la función valida y solo permite crear lo previsto. |
| D5 | La IA no escribe en la base | Devuelve JSON validado con zod; la solicitud se crea solo con confirmación explícita del cliente. |
| D6 | Turnos protegidos por constraint de exclusión | Dos confirmaciones simultáneas no pueden solaparse: lo garantiza Postgres, no el código. |
| D7 | Configuración regional centralizada | `src/config/regional.ts` + overrides por workspace. Ningún componente asume `ARS` ni `es-AR`. |
| D8 | TypeScript 5.9 en lugar de 7.0 | Es lo que instala la plantilla oficial de Next 16.4. TS 7.0.2 compiló y buildeó bien en una prueba (14/10/2026); se reevalúa cuando Next lo adopte por defecto. |
| D9 | Claves nuevas de Supabase (publishable/secret) | Reemplazan a anon/service_role en proyectos nuevos. |
| D10 | Registro público desactivado | v1 es para un solo tatuador. Cuentas por invitación. |

## Notas de Next.js 16

- `middleware.ts` pasa a llamarse `proxy.ts` (ver `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`).
- `cacheComponents` está activo: los datos por request deben ir dentro de `<Suspense>` o en rutas dinámicas. Ningún dato privado se cachea entre usuarios.
- `AGENTS.md` lo genera Next y apunta a la documentación local de la versión instalada.

## Integraciones

| Integración | Para qué | Fase |
|---|---|---|
| Supabase | Datos, auth, archivos | 0 (hecho) |
| Vercel | Hosting | 1 |
| Cloudflare Turnstile | Anti-spam | 2 |
| Resend | Emails | 2 |
| Proveedor de IA (Anthropic por defecto) | Ink Assistant | 4 |

## Sistema de diseño

- Tokens en `src/app/globals.css` (`@theme` de Tailwind 4): superficies `ink` → `surface-3`, texto `fg` / `fg-muted` / `fg-subtle`, acento rojo `accent` (relleno, con texto blanco) y `accent-text` (texto rojo sobre oscuro), tomado de la identidad de @tattoobyesti, y tonos de estado. Contrastes WCAG AA verificados.
- Tipografías: Anton (títulos condensados, `font-display`, en línea con la gráfica de sus reels) y Geist (interfaz), servidas por `next/font`.
- Primitivas en `src/components/ui`: Button, Spinner, TextField, TextAreaField, SelectField, Badge, RequestStatusBadge, EmptyState, Skeleton, ConfirmDialog (`<dialog>` nativo).
- Animaciones solo con CSS; todas se desactivan con `prefers-reduced-motion`.
- Los estados de solicitud viven en `src/config/request-status.ts` (etiqueta y tono), fuente única para UI y base de datos.
