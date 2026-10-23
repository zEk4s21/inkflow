# Seguridad

## Roles

| Rol | Cómo accede | Puede |
|---|---|---|
| Visitante | Sin cuenta | Ver contenido publicado; enviar consultas y pedidos de turno (con captcha y rate limit) |
| Cliente | Link con token aleatorio (se guarda solo el hash) | Ver el estado de **su** solicitud, su presupuesto y sus turnos (solo lectura) |
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
| `INKFLOW_ALLOW_NO_CAPTCHA`, `INKFLOW_ALLOW_SIMULATED_AI` | Solo desarrollo y CI. **Nunca en producción**. Con `VERCEL_ENV=production` la app las ignora aunque estén cargadas |
| `AI_API_KEY` | Secreta, solo servidor (Fase 4) |
| `EMAIL_API_KEY` | Secreta, solo servidor (Fase 5.5) |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Secretas. Solo en el environment `production` de GitHub, para el workflow manual de migraciones |

`pnpm check:prod` revisa las variables de producción antes de salir: URLs https, claves faltantes, secretos con prefijo `NEXT_PUBLIC_`, claves de prueba de Turnstile y modos de prueba. Nunca imprime valores.

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

- Agenda (`src/server/availability`): miembros leen horarios y bloqueos; owner o artista los cambian. `set_weekly_availability` y `add_availability_block` corren con los permisos de quien llama (la RLS se aplica) y además validan el rol. Anon no lee estas tablas: la página pública recibe solo los inicios y fines de los turnos libres, calculados en el servidor (`src/server/availability/public.ts`). Cubierto por `tests/integration/rls-availability.test.ts`.

- Pedido de turno: entra por la misma Server Action del formulario (captcha, trampa, límite de envíos). El servidor recalcula los turnos libres en ese momento y rechaza cualquier inicio que no esté en la lista, así que no se puede pedir un horario inventado, bloqueado o fuera de la anticipación mínima. El turno se guarda como `requested` y no reserva nada: nunca se le dice al cliente que está reservado. Anon no tiene privilegios sobre `appointments`.

- Gestión de turnos (`src/server/appointments/actions.ts`): owner o artista cambian estado y horario (únicas columnas editables) y dan turnos a mano (`source = 'manual'`, solo pedidos o confirmados); staff solo lee. Las transiciones las valida un trigger en la base, no solo la interfaz. Dos turnos confirmados que se pisan los rechaza la restricción de exclusión aunque lleguen en paralelo. Cubierto por `tests/integration/appointments-management.test.ts`. Cubierto por `tests/integration/rls-appointments.test.ts` y `tests/e2e/appointments.spec.ts`.

- IA (`src/server/integrations/ai`): proveedor y clave solo en variables de servidor (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, sin prefijo `NEXT_PUBLIC_`). El panel muestra proveedor, modelo y límites, nunca la clave, y los errores del proveedor no incluyen la clave ni el texto enviado. Sin configuración, la página del asistente no dice por qué: solo ofrece el formulario. El modelo solo devuelve texto; no tiene herramientas ni escribe en la base.

- Ink Assistant (`src/server/assistant`): todo entra por una Server Action. La primera vez pide Turnstile y aplica un límite de 5 conversaciones nuevas por hora por conexión y 60 por estudio; después la conversación se reconoce con un token al azar en una cookie httpOnly limitada a la página del asistente de ese estudio, y en la base queda solo su sha256. El historial y el resumen se leen de la base, nunca de lo que manda el navegador. La salida del modelo se valida con zod (si no valida, un reintento y después error); el resumen solo se completa o corrige, y "listo" lo decide el servidor. El chat no pide datos de contacto. Topes: mensajes por conversación (rechequeado en la base, aunque lleguen en paralelo) y tokens por mes y estudio (mes UTC, conversaciones empezadas ese mes). `AI_PROVIDER=simulated` solo funciona con `INKFLOW_ALLOW_SIMULATED_AI=1`, se marca en la página y en el panel, y nunca va en producción. Con el tope mensual alcanzado, la página no ofrece el chat. Retención: `purge_expired_conversations` (pg_cron, todos los días 04:17 UTC) borra los mensajes y el resumen de las conversaciones vencidas que no terminaron en consulta, y las filas a los 62 días; solo la clave secreta puede llamarla. `workspace_ai_usage` corre con RLS: cada miembro ve solo el consumo de su estudio. La consulta la crea `confirmAssistantRequest` solo con la casilla de confirmación tildada (validado en el servidor), con los campos que la persona revisó; antes marca la conversación como `confirmed` con un update condicional, así un doble envío no duplica. Comparte el límite de consultas del formulario (`src/server/requests/intake.ts`). Cubierto por `tests/unit/assistant.test.ts`, `tests/integration/rls-conversations.test.ts` y `tests/e2e/assistant-chat.spec.ts`.

- Presupuestos (`src/server/quotes/actions.ts`): owner o artista los crean y cambian (la acción vuelve a validar el rol y valida con zod; la RLS y los privilegios por columna son la segunda barrera); staff solo lee y anon nada. La moneda la pone el servidor con la del estudio, no el formulario. Transiciones, edición solo en borrador y "un abierto por solicitud" los garantiza la base, no la interfaz. El cambio de estado de la solicitud que dispara un presupuesto corre con los permisos de quien lo hace, así el historial registra quién fue. Todavía no se exponen a clientes. Cubierto por `tests/integration/rls-quotes.test.ts`, `tests/unit/quotes.test.ts` y `tests/e2e/quotes.spec.ts`.

- Link para el cliente (`src/server/client-link`): token de 256 bits al azar en la ruta `/seguimiento/<token>`; en la base solo su sha256 (único). Lo generan owner o artista (la acción valida el rol; la RLS de `tattoo_requests` y el privilegio por columna lo repiten) y se muestra una sola vez. Generar otro o desactivarlo invalida el anterior; también deja de andar si la solicitud se borra. La página lee con la clave secreta y elige a mano qué mostrar: estado, último presupuesto enviado (no borradores ni retirados), turnos pedidos a futuro, confirmados o realizados, la idea, zona y tamaño. Nunca notas, historial, conversación, contacto ni ids. Sale con `Referrer-Policy: no-referrer` y `noindex`. Un token inválido muestra el mismo aviso exista o no. No hay límite de intentos: adivinar 256 bits no es viable. Cubierto por `tests/integration/rls-client-link.test.ts`, `tests/unit/client-link.test.ts` y `tests/e2e/client-link.spec.ts`.

- Pagos (`src/server/payments/actions.ts`): owner o artista registran y anulan (acción con rol + zod, fecha no futura en la zona del estudio; RLS y privilegios por columna como segunda barrera); staff solo lee y anon nada. La moneda la pone el servidor. Un pago no se edita ni se borra: la única columna actualizable es `voided_at`, y el trigger pone la fecha y el usuario reales. El link del cliente muestra solo el total cobrado, nunca el medio ni las notas. Cubierto por `tests/integration/rls-payments.test.ts`, `tests/unit/payments.test.ts` y `tests/e2e/payments.spec.ts`.

- Cuidados y controles: los cuidados los edita solo el owner (`updateCareInstructions`, privilegio por columna y RLS de `workspace_settings`); como el resto de la configuración de un estudio publicado, son legibles públicamente, así que no deben llevar datos privados. El link del cliente los muestra solo cuando la sesión ya se hizo. Los controles (`src/server/follow-ups`) los ven los miembros y los cambian owner o artista; los automáticos los crea un trigger con los permisos de quien cierra el turno, y "hecho" lo fechan la base y el usuario de la sesión. No se exponen al cliente. Cubierto por `tests/integration/rls-follow-ups.test.ts`, `tests/unit/follow-ups.test.ts` y `tests/e2e/follow-ups.spec.ts`.

- Emails (`src/server/integrations/email`, `src/server/notifications`): proveedor y clave solo en variables de servidor (`EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`). Sin ellas no se llama a ningún servicio y cada aviso queda como `skipped`; el panel muestra proveedor y remitente, nunca la clave, y los errores guardan solo el código HTTP. El aviso al equipo lleva el nombre del cliente y el link al panel, no la idea ni el contacto. Todo lo que viene de usuarios se escapa en el HTML. Cada envío lleva una clave de idempotencia por solicitud y destinatario. Los destinatarios salen de la base (miembros owner/artista y el email del cliente), nunca del formulario más allá del email del propio cliente. `email_log` no guarda direcciones. Cubierto por `tests/unit/email.test.ts`, `tests/integration/rls-email-log.test.ts` y `tests/e2e/requests.spec.ts`.

- Registro público desactivado (`supabase/config.toml` → `[auth] enable_signup = false`). Cubierto por un test de integración.
- Redirects de auth limitados a `/auth/callback` local.

## Riesgos conocidos

| Riesgo | Mitigación prevista |
|---|---|
| RLS mal escrita | Tests de aislamiento en CI (`tests/integration/rls-workspaces.test.ts`) |
| Uso indebido de la secret key | Solo importable desde un módulo de servidor dedicado |
| Prompt injection en el asistente | El modelo no tiene herramientas de escritura; la salida se valida y la confirmación es del usuario |
| Abuso de formularios o costo de IA | Formulario: Turnstile, campo trampa y límite de envíos (implementado). IA: tope de mensajes y presupuesto por workspace |
| Privacidad (Ley 25.326) | Minimización, borrado del asistente a los 7 días y borradores de privacidad y términos en `docs/legal`. Pendiente: revisión legal, inscripción en la AAIP si corresponde, base legal de la transferencia internacional (Supabase en Brasil, proveedores en EE.UU.) y aviso del art. 6 en el formulario |
