# Salir a producción

Guía para poner INKFLOW en línea con Supabase (base, login y archivos), Vercel (la app), Cloudflare Turnstile (captcha) y Resend (emails). El asistente de IA es opcional.

Todo se crea con cuentas del dueño del proyecto. Las claves se cargan **solo** en los paneles de Supabase, Vercel y GitHub: nunca en el repo, en el chat ni en un archivo que se suba.

Los datos de cada servicio (límites, nombres de menús) se revisaron el 19/10/2026 en la documentación oficial que se enlaza. Si un menú cambió de nombre, manda la documentación.

## 0. Antes de empezar

- Un dominio (por ejemplo `inkflow.com.ar` o `estitattoo.com`) con acceso a sus DNS.
- Los textos legales revisados por un abogado (ver [docs/legal](legal/)). No salir a producción con los borradores.
- Lo que tiene que pasar el tatuador: email para entrar al panel, bio, fotos originales y la confirmación de los textos de proceso, preguntas frecuentes y cuidados.

## 1. Supabase

1. Crear el proyecto en la región **São Paulo** (`sa-east-1`, [regiones](https://supabase.com/docs/guides/platform/regions)). Guardar la contraseña de la base en un gestor de contraseñas.
2. **Migraciones**: no se aplican a mano. En GitHub, Settings > Environments > New environment `production`. Opcional: agregar "Required reviewers" para que nadie lo corra sin aprobación. Cargar ahí estos tres secretos ([guía de Supabase](https://supabase.com/docs/guides/deployment/managing-environments)):
   - `SUPABASE_ACCESS_TOKEN`: se crea en el Dashboard > Account > Access Tokens.
   - `SUPABASE_DB_PASSWORD`: la contraseña del paso 1.
   - `SUPABASE_PROJECT_ID`: el "project ref", que aparece en la URL del proyecto.

   Después: Actions > **Base de producción** > Run workflow. La primera vez dejá tildado "Solo mostrar" y revisá la lista. Después corrélo destildado. Se repite con cada fase nueva que agregue migraciones.
3. **Verificar después de la primera migración**:
   - Storage tiene el bucket `portfolio`.
   - Integrations > Cron muestra el job `inkflow-purge-conversations` (borra a diario las charlas vencidas del asistente).

   La migración crea pg_cron con `create extension`. Supabase documenta también activarlo desde el dashboard ([pg_cron](https://supabase.com/docs/guides/cron/install)). Si el job no aparece, activalo ahí y volvé a correr el workflow.
4. **Login** (Authentication):
   - **Registro de usuarios nuevos desactivado.** Las cuentas se crean por invitación con `pnpm member:add`.
   - **URL Configuration** ([doc](https://supabase.com/docs/guides/auth/redirect-urls)):
     - Site URL: `https://tu-dominio`.
     - Redirect URLs: `https://tu-dominio/auth/confirm`.
     - Para probar en los previews de Vercel, sumar `https://*-<tu-equipo>.vercel.app/**`.
   - **Email Templates > Magic Link**:
     - Asunto: `Tu link para entrar a INKFLOW`.
     - Cuerpo: pegar el contenido de `supabase/templates/magic-link.html`. En proyectos alojados la plantilla se carga desde el dashboard; el `config.toml` es solo para local ([doc](https://supabase.com/docs/guides/local-development/customizing-email-templates)).
   - **SMTP propio (obligatorio)**:
     - El email que trae Supabase solo manda a miembros del equipo del proyecto, unos 2 por hora, y no es para producción ([doc](https://supabase.com/docs/guides/auth/auth-smtp)).
     - Con Resend: host `smtp.resend.com`, puerto `465`, usuario `resend` y, como contraseña, una API key de Resend ([doc](https://resend.com/docs/send-with-supabase-smtp)). El remitente tiene que ser del dominio verificado (paso 2).
     - Al activar el SMTP propio, el límite arranca en 30 emails por hora y se cambia en Rate Limits.
5. **Claves** (Project Settings > API Keys): la URL del proyecto, la *publishable key* y la *secret key*. La secret saltea la seguridad por fila: solo va en Vercel como `SUPABASE_SECRET_KEY` y en la máquina de quien hace el alta de estudios.

## 2. Resend (emails)

1. Agregar el dominio y cargar en los DNS los registros que muestra la pestaña Records: DKIM y SPF ([doc](https://resend.com/docs/add-a-domain)). DMARC se puede sumar después.
2. Crear una API key. La misma sirve para el SMTP de Supabase (paso 1.4) y para `EMAIL_API_KEY`. Si se prefiere, crear dos para poder revocarlas por separado.
3. El plan gratis permite 100 emails por día y 3.000 por mes ([límites](https://resend.com/docs/knowledge-base/account-quotas-and-limits)). Los emails del login también cuentan.

Sin este paso la app funciona igual, pero no se puede entrar al panel (no llega el link) y no sale ningún aviso.

## 3. Cloudflare Turnstile (captcha)

En Cloudflare: Turnstile > Add widget, con el dominio como hostname y el modo Managed. Copiar la *site key* y la *secret key* ([doc](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)). El plan Free alcanza ([planes](https://developers.cloudflare.com/turnstile/plans/)).

Sin estas claves el formulario de consulta y el asistente se muestran como no disponibles.

## 4. Vercel

1. Importar el repo `zEk4s21/inkflow` (Next.js se detecta solo).
2. Settings > Environment Variables, en **Production**, con los valores de los pasos anteriores:

   | Variable | De dónde sale |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase, paso 1.5 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase, paso 1.5 |
   | `SUPABASE_SECRET_KEY` | Supabase, paso 1.5 (marcarla como *Sensitive*) |
   | `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Turnstile, paso 3 |
   | `EMAIL_API_KEY`, `EMAIL_FROM` | Resend, paso 2 (`EMAIL_FROM` del dominio verificado, por ejemplo `Esti Tattoo <avisos@tu-dominio>`) |
   | `AI_API_KEY`, `AI_MODEL`, `AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE` | Opcional: Anthropic. Elegir el modelo y poner un tope mensual |

   **Nunca** cargar en producción `INKFLOW_ALLOW_NO_CAPTCHA`, `INKFLOW_ALLOW_SIMULATED_AI` ni `AI_PROVIDER=simulated`. Igual, en el deploy de producción la app los ignora.
3. Dejar activada la opción que expone las **System Environment Variables** (Settings > Environment Variables). La app usa `VERCEL_ENV` para saber que está en producción y apagar los modos de prueba ([doc](https://vercel.com/docs/environment-variables/system-environment-variables)).
4. Settings > Domains: agregar el dominio y seguir las instrucciones de DNS.
5. **Chequeo previo**: con la [CLI de Vercel](https://vercel.com/docs/cli/env), ejecutar:

   ```bash
   vercel env pull .env.production.local --environment=production
   pnpm check:prod .env.production.local
   rm .env.production.local
   ```

   Marca con ✗ lo que impide salir y con ! lo que queda apagado (IA o emails). No muestra ningún valor. El archivo bajado tiene las claves: borralo al terminar (los `.env*.local` no se suben al repo).
6. Hacer el deploy (Deployments > Redeploy, o un push a `main`).

## 5. Alta del estudio

En una máquina de confianza, con un `.env.local` que apunte a producción (la URL y la `SUPABASE_SECRET_KEY` de producción), ejecutar:

```bash
pnpm studio:create esti "Esti Tattoo" "Esti"
pnpm member:add <email-del-tatuador> esti owner
```

Después, volvé a dejar el `.env.local` apuntando a la base local.

El tatuador entra en `https://tu-dominio/ingresar` con su email. Desde Ajustes completa el perfil, el proceso, las preguntas frecuentes, los cuidados y el horario, y publica la página. En producción el portfolio arranca vacío: las fotos se suben desde el panel.

## 6. Prueba final

1. Página pública: se ve en `https://tu-dominio/artist/esti`.
2. Consulta de prueba desde el celular: aparece el captcha, la consulta llega al panel y en Ajustes > Emails los dos avisos figuran como "Enviado".
3. Login: el link llega y entra al panel.
4. Link del cliente: abrirlo en una ventana privada.
5. Borrar la consulta de prueba o marcarla como cerrada.

## Lo que no está confirmado

- Si `supabase config push` sube la plantilla del magic link y el SMTP: no está documentado, por eso se cargan a mano en el dashboard.
- Que `create extension pg_cron` dentro de la migración alcance en un proyecto alojado: por eso el paso 1.3 lo verifica.
