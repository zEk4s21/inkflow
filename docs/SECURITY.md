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
| `portfolio` | Público para leer por URL. Subir y borrar: owner o artista, solo en la carpeta `<workspace_id>/` (políticas en `storage.objects`). JPG/PNG/WebP hasta 10 MB. Las fotos se achican a 2000 px en el navegador, lo que además elimina los metadatos EXIF (ubicación GPS). Al borrar un trabajo se borra la foto |
| `client-private` | Privado. URLs firmadas de corta vida, solo para miembros del workspace |

Las referencias que manda un cliente **nunca** pasan al portfolio automáticamente.

## Variables de entorno

| Variable | Exposición |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` | Públicas por diseño |
| `SUPABASE_SECRET_KEY` | **Secreta.** Saltea RLS. Solo en `src/server` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Pública por diseño |
| `TURNSTILE_SECRET_KEY` | **Secreta.** Verifica el captcha en el servidor |
| `INKFLOW_ALLOW_NO_CAPTCHA` | Solo desarrollo y CI. **Nunca en producción**: deja el formulario sin captcha |
| `AI_API_KEY`, `RESEND_API_KEY` | Secretas (fases futuras) |

## Configuración vigente

- Login sin contraseña por magic link (`/ingresar`). `shouldCreateUser: false`: el login nunca crea cuentas, y la respuesta es la misma exista o no el email.
- El link del email apunta a `/auth/confirm`, que valida el `token_hash` en el servidor (sirve aunque se abra en otro dispositivo) y solo redirige a rutas internas. Es de un solo uso y vence en una hora.
- `/panel` tiene tres barreras: `src/proxy.ts` redirige sin sesión, `getPanelContext()` valida el JWT con `getClaims()` y exige membresía de un workspace, y la RLS filtra cada consulta.
- Producción: copiar `supabase/templates/magic-link.html` en Dashboard > Authentication > Email Templates > Magic Link, y configurar la Site URL con el dominio real.
- Las Server Actions de Ajustes (`src/server/settings/actions.ts`) vuelven a validar sesión y rol (solo owner) y validan con zod antes de escribir; la RLS es la segunda barrera.
- La página pública se lee con un cliente anon sin cookies (`src/server/supabase/public.ts`), cacheado con `use cache` y refrescado con `updateTag` al guardar.
- Cubierto por `tests/e2e/auth.spec.ts` (entra un miembro, una cuenta sin estudio no ve el panel, el link no se reutiliza).

- Formulario de consulta (`src/server/requests/actions.ts`): el navegador nunca escribe en la base. La Server Action descarta bots con un campo trampa, valida con zod, verifica Turnstile en el servidor (si Cloudflare no responde, rechaza), confirma que la página esté publicada y aplica el límite de envíos antes de insertar con la clave secreta. `anon` no tiene ningún privilegio sobre `clients` ni `tattoo_requests`.
- Límite de envíos: 3 por hora por conexión y 30 por hora por estudio. La conexión se identifica con un HMAC-SHA256 de la IP (clave: `SUPABASE_SECRET_KEY`), así que la IP no se guarda. La IP sale del primer valor de `x-forwarded-for`, que en Vercel pone la plataforma; detrás de otro proxy hay que revisarlo.
- Sin claves de Turnstile el formulario se muestra como no disponible en vez de aceptar envíos sin captcha.
- Solicitudes en el panel (`src/server/requests/panel-actions.ts`): owner o artista cambian el estado (única columna editable) y escriben notas; staff solo lee. El historial lo escribe un trigger `security definer` con `auth.uid()`, así que no se puede falsificar quién hizo un cambio. Las notas se firman con el usuario de la sesión (la RLS rechaza otro `author_id`) y solo su autor puede borrarlas. Owner o artista editan nombre y datos de contacto de los clientes (no `workspace_id`). Unir clientes pasa por `public.merge_clients`, una función `security definer` que valida el rol del usuario y que ambos clientes sean del mismo workspace antes de mover solicitudes; anon no puede ejecutarla. Cubierto por `tests/integration/rls-requests.test.ts` y `tests/e2e/requests.spec.ts`.

- Agenda (`src/server/availability`): miembros leen horarios y bloqueos; owner o artista los cambian. `set_weekly_availability` y `add_availability_block` corren con los permisos de quien llama (la RLS se aplica) y además validan el rol. Anon no ve nada todavía: la disponibilidad pública llega con el pedido de turno (3.2). Cubierto por `tests/integration/rls-availability.test.ts`.

- Registro público desactivado (`supabase/config.toml` → `[auth] enable_signup = false`). Cubierto por un test de integración.
- Redirects de auth limitados a `/auth/callback` local.

## Riesgos conocidos

| Riesgo | Mitigación prevista |
|---|---|
| RLS mal escrita | Tests de aislamiento en CI (`tests/integration/rls-workspaces.test.ts`) |
| Uso indebido de la secret key | Solo importable desde un módulo de servidor dedicado |
| Prompt injection en el asistente | El modelo no tiene herramientas de escritura; la salida se valida y la confirmación es del usuario |
| Abuso de formularios o costo de IA | Formulario: Turnstile, campo trampa y límite de envíos (implementado). IA: tope de mensajes y presupuesto por workspace |
| Privacidad (Ley 25.326) | Minimización, consentimiento y borrado a pedido. Requiere revisión legal antes de comercializar |
