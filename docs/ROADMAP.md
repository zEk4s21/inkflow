# Roadmap

Alcance: microapp para un tatuador, con base preparada para venderse como SaaS.

## Fase 0 · Base técnica ✅

| Tarea | Estado | Evidencia |
|---|---|---|
| 0.1 Next.js 16 + TS + Tailwind + ESLint + Vitest + Playwright + CI | Hecho | `pnpm lint`, `typecheck`, `test`, `build` y `e2e` pasan |
| 0.2 Documentación base | Hecho | `README.md`, `docs/` |
| 0.3 Supabase local + `.env.example` + validación de variables | Hecho | Test de integración: registro público rechazado |

## Fase 1 · Diseño y estructura visual ✅

- [x] 1.1 Tokens, tipografías y primitivas UI: catálogo en `/dev/ui` (solo desarrollo). **Pendiente de aprobación visual.** Falta el componente Toast (se suma con los formularios reales).
- [x] 1.2 Página pública del artista en `/artist/esti`: portada, perfil, proceso, FAQ y contacto. Contenido demo con aviso visible; formulario y asistente marcados como "Próximamente".
- [x] 1.3 Portfolio con filtros (solo categorías con trabajos) y ficha de trabajo con navegación anterior/siguiente. Fallback si una foto no carga.
- [x] 1.4 Panel en `/panel`: sidebar en compu, barra inferior en celu/tablet; Inicio, Solicitudes, Agenda, Clientes, Portfolio y Ajustes con estados vacíos y marcas "Disponible en la Fase N". Protegido con login desde la Fase 2.2.

## Fase 2 · Fundamentos funcionales (en curso)

- [x] 2.1 Migraciones de workspaces, miembros, settings y perfiles + RLS, con tests de aislamiento entre workspaces
- [x] 2.2 Login por magic link + protección de `/panel`. El panel muestra el estudio y el perfil reales; solicitudes y portfolio siguen con datos demo hasta 2.4-2.6
- [x] 2.3 Perfil y página pública editables desde Ajustes (nombre, bio, estilos, estudio, Instagram, publicar/ocultar, proceso y FAQ). La página pública lee de Supabase; los trabajos siguen siendo demo hasta 2.4
- [x] 2.4 Portfolio administrable: subir foto (se achica en el navegador), título, categoría, zona, descripción, texto alternativo, publicar/ocultar, reordenar y borrar. La página pública lee solo trabajos publicados
- [x] 2.5 Formulario de consulta en la página pública con Cloudflare Turnstile, campo trampa y límite de envíos (3 por hora por conexión, 30 por hora por estudio). Cada consulta crea o reutiliza el cliente por email o WhatsApp. En el panel: lista y detalle de solicitudes, lista de clientes y solicitudes nuevas en Inicio (solo lectura)
- [x] 2.6 Solicitudes: cambiar estado desde el detalle (owner o artista, cualquier estado a cualquier otro), historial automático con quién y cuándo, notas internas (cada uno borra las suyas) y filtro por estado en el listado
- [ ] 2.7 Clientes: editar, unir duplicados que no comparten email ni teléfono

## Fase 3 · Turnos

- [ ] 3.1 Disponibilidad y bloqueos
- [ ] 3.2 Pedido de turno público
- [ ] 3.3 Aprobar, reprogramar y cancelar (test de concurrencia)

## Fase 4 · Ink Assistant

- [ ] 4.1 Proveedor configurable + estado "no configurado"
- [ ] 4.2 Conversación con brief estructurado
- [ ] 4.3 Confirmación y creación de solicitud
- [ ] 4.4 Límites y costos

## Después de validar con el tatuador

Presupuestos y pagos manuales, cuidados y seguimiento, auditoría, onboarding de nuevos tatuadores y planes.

## Problemas conocidos

- Las fotos demo son recortes de capturas de Instagram (baja calidad), no se versionan y solo se cargan en local con `pnpm db:seed-portfolio`. En producción el portfolio arranca vacío hasta que Esteban suba sus originales.
- La biografía de Esteban no está cargada; los textos de proceso y FAQ del seed son provisorios.
- Sin claves de Turnstile el formulario se muestra como "no disponible" y deriva a Instagram. En producción hay que cargar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.
- El formulario todavía no acepta fotos de referencia: se piden por Instagram.
- Con Cache Components, `generateStaticParams` no puede devolver una lista vacía: si la base no tiene slugs (o no responde en el build) se prerenderiza un slug placeholder `_` que responde 404.
