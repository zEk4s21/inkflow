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
- [x] 1.4 Panel en `/panel`: sidebar en compu, barra inferior en celu/tablet; Inicio, Solicitudes, Agenda, Clientes, Portfolio y Ajustes con estados vacíos y marcas "Disponible en la Fase N". **En producción devuelve 404** hasta que exista login (vista previa con `INKFLOW_PANEL_PREVIEW=1`).

## Fase 2 · Fundamentos funcionales (siguiente)

- [ ] 2.1 Migraciones de workspaces, miembros, settings y perfiles + RLS
- [ ] 2.2 Login por magic link + protección de `/panel`
- [ ] 2.3 Perfil y página pública editables
- [ ] 2.4 Portfolio administrable
- [ ] 2.5 Formulario de consulta (captcha + rate limit)
- [ ] 2.6 Solicitudes: estados, historial, notas
- [ ] 2.7 Clientes con deduplicación

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

- Las fotos demo son recortes de capturas de Instagram (baja calidad) y no se versionan (`public/demo/` en `.gitignore`). En un clon limpio se ve el reemplazo "Imagen no disponible". Se reemplazan por originales en la Fase 2.
- La biografía de Esteban no está cargada; textos de proceso y FAQ son provisorios.
