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

- RLS en todas las tablas privadas mediante `is_workspace_member(workspace_id)`.
- Tests obligatorios (Fase 2): un usuario del workspace A no puede leer ni escribir datos de B, ni por API ni cambiando IDs en la URL.

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

- Registro público desactivado (`supabase/config.toml` → `[auth] enable_signup = false`). Cubierto por un test de integración.
- Redirects de auth limitados a `/auth/callback` local.

## Riesgos conocidos

| Riesgo | Mitigación prevista |
|---|---|
| RLS mal escrita | Tests de aislamiento en CI (Fase 2) |
| Uso indebido de la secret key | Solo importable desde un módulo de servidor dedicado |
| Prompt injection en el asistente | El modelo no tiene herramientas de escritura; la salida se valida y la confirmación es del usuario |
| Abuso de formularios o costo de IA | Turnstile, rate limit, tope de mensajes y presupuesto por workspace |
| Privacidad (Ley 25.326) | Minimización, consentimiento y borrado a pedido. Requiere revisión legal antes de comercializar |
