# Seguridad

## Roles

| Rol | Cómo accede | Puede |
|---|---|---|
| Visitante | Sin cuenta | Ver contenido publicado; enviar consultas y pedidos de turno (con captcha y rate limit) |
| Cliente | Link con token aleatorio (se guarda solo el hash) | Ver el estado de **su** solicitud |
| `owner` / `artist` | Sesión de Supabase Auth | Administrar su workspace |
| `staff` (futuro) | Sesión | Permisos acotados dentro del workspace |

## Principios

1. **El navegador no prueba nada.** El usuario sale de la cookie de sesión (`supabase.auth.getUser()`), nunca de un ID enviado por el cliente.
2. **Doble barrera:** cada operación protegida verifica membresía en el servidor y, además, la RLS de Postgres filtra por `workspace_id`.
3. **Secretos solo en servidor:** `src/server/**` importa `server-only`, así que el build falla si un componente de cliente lo importa.
4. **Validación en servidor** con zod en cada Server Action, aunque el formulario ya valide.
5. **Minimización de datos:** no se guardan datos de tarjetas, y las conversaciones del asistente tienen retención limitada.

## Aislamiento entre tatuadores

- RLS en todas las tablas con `private.is_member(workspace_id)` y `private.has_role(workspace_id, roles)`. Son funciones `security definer` en el esquema `private`, que la API no expone.
- Además de RLS, privilegios por columna: `anon` solo lee columnas públicas (por ejemplo, no ve `artist_profiles.user_id`) y nadie puede escribir `id`, `workspace_id`, `user_id` ni timestamps desde la API.
- Altas de workspaces y miembros: solo con la clave secreta. No hay política de insert para usuarios, así que nadie puede sumarse a un workspace ni cambiar su rol.
- Lo público (workspace, configuración y perfil) se ve solo si el workspace tiene un perfil con `is_public = true`.
- Tests de aislamiento en `tests/integration/rls-workspaces.test.ts`, en CI contra Supabase local.

## Archivos

| Bucket | Acceso |
|---|---|
| `portfolio` | Público (solo imágenes de trabajos publicados) |
| `client-private` | Privado. URLs firmadas de corta vida, solo para miembros del workspace |

Las referencias que manda un cliente **nunca** pasan al portfolio automáticamente.

## Variables de entorno

| Variable | Exposición |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` | Públicas por diseño |
| `SUPABASE_SECRET_KEY` | **Secreta.** Saltea RLS. Solo en `src/server` |
| `AI_API_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` | Secretas (fases futuras) |

## Configuración vigente

- Login sin contraseña por magic link (`/ingresar`). `shouldCreateUser: false`: el login nunca crea cuentas, y la respuesta es la misma exista o no el email.
- El link del email apunta a `/auth/confirm`, que valida el `token_hash` en el servidor (sirve aunque se abra en otro dispositivo) y solo redirige a rutas internas. Es de un solo uso y vence en una hora.
- `/panel` tiene tres barreras: `src/proxy.ts` redirige sin sesión, `getPanelContext()` valida el JWT con `getClaims()` y exige membresía de un workspace, y la RLS filtra cada consulta.
- Producción: copiar `supabase/templates/magic-link.html` en Dashboard > Authentication > Email Templates > Magic Link, y configurar la Site URL con el dominio real.
- Las Server Actions de Ajustes (`src/server/settings/actions.ts`) vuelven a validar sesión y rol (solo owner) y validan con zod antes de escribir; la RLS es la segunda barrera.
- La página pública se lee con un cliente anon sin cookies (`src/server/supabase/public.ts`), cacheado con `use cache` y refrescado con `updateTag` al guardar.
- Cubierto por `tests/e2e/auth.spec.ts` (entra un miembro, una cuenta sin estudio no ve el panel, el link no se reutiliza).

- Registro público desactivado (`supabase/config.toml` → `[auth] enable_signup = false`). Cubierto por un test de integración.
- Redirects de auth limitados a `/auth/callback` local.

## Riesgos conocidos

| Riesgo | Mitigación prevista |
|---|---|
| RLS mal escrita | Tests de aislamiento en CI (`tests/integration/rls-workspaces.test.ts`) |
| Uso indebido de la secret key | Solo importable desde un módulo de servidor dedicado |
| Prompt injection en el asistente | El modelo no tiene herramientas de escritura; la salida se valida y la confirmación es del usuario |
| Abuso de formularios o costo de IA | Turnstile, rate limit, tope de mensajes y presupuesto por workspace |
| Privacidad (Ley 25.326) | Minimización, consentimiento y borrado a pedido. Requiere revisión legal antes de comercializar |
