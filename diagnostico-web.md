# Diagnóstico Inkflow — 2026-11-05

Solo diagnóstico, no se tocó código. Revisado con `ui-ux-pro-max` (checklist de accesibilidad, toque, responsive, formularios) y `systematic-debugging` para los bugs.
App levantada en local (`pnpm dev` + Supabase local) y recorrida en el navegador integrado a **375×812 (celular)** y **1280×800 (compu)**:
página pública `/artist/esti` → portfolio → visor → "Quiero algo así" → formulario de consulta (vacío, solo Instagram, válido) → login con link mágico (Mailpit) → panel: inicio, solicitudes, detalle, clientes, ficha, agenda, portfolio, ajustes.

**Lo que anda bien:** ninguna imagen rota (16/16), sin errores de JS de la app en consola, página pública sin scroll horizontal, visor del portfolio con deslizar y Esc, formulario envía bien y muestra "¡Gracias!", textos alternativos en todas las fotos del portfolio, foco visible global, `prefers-reduced-motion` respetado, barra inferior del panel con 5 ítems.

> Nota: para probar de punta a punta quedó cargada en la base **local** una consulta de prueba ("Prueba Diagnostico", WhatsApp 11 5555-0000). Se puede borrar desde el panel o con `pnpm db:reset`.

---

## Bugs

### ALTA

1. **El link de WhatsApp al cliente apunta a otro país.**
   - Qué pasa: el formulario público pide WhatsApp "Con código de área" (`src/components/public/request-form.tsx:85`). Un cliente argentino escribe `11 5555-0000`; se guarda `1155550000` y el panel arma `https://wa.me/1155550000`, que WhatsApp interpreta como +1 (EE.UU./Canadá). Probado: en el detalle de la solicitud aparece "+1155550000".
   - Causa raíz: `normalizePhone` solo borra lo que no es dígito (`src/server/requests/schemas.ts:13-15`) y los links usan el número tal cual: `src/app/panel/solicitudes/[id]/page.tsx:94`, `src/components/panel/follow-ups/follow-up-list.tsx:54`, `src/components/panel/requests/client-link.tsx:70` (este último manda el link de seguimiento al número equivocado). Además el formulario del panel pide "código de país" (`client-form.tsx:36`) y el público no: el mismo cliente puede quedar como dos números distintos y no se une al deduplicar (`src/server/requests/intake.ts:33`).
   - Cómo se arregla: normalizar a formato internacional al guardar (si no empieza con código de país, anteponer el del estudio, `54` + `9` para celulares de Argentina; quitar el `0` y el `15` locales), cambiar la ayuda del formulario a "Ej.: 11 2233-4455" y migrar los teléfonos ya guardados.

2. **Panel en celular: el inicio y la ficha de cliente se salen de la pantalla.**
   - Qué pasa: en 375 px la página mide 402 px (inicio) y 453 px (ficha de cliente). Se cortan "Ver todas", "Ver agenda", los campos del formulario de contacto y aparece scroll horizontal.
   - Causa raíz (confirmada en el navegador): las grillas `grid gap-6 xl:grid-cols-[...]` en celular tienen una sola columna implícita `auto`, que crece hasta el ancho del texto largo con `truncate` (la idea de la solicitud). Al forzar `grid-template-columns: minmax(0,1fr)` el ancho vuelve a 375.
   - Dónde: `src/app/panel/page.tsx:39`, `src/app/panel/clientes/[id]/page.tsx:40`; mismo patrón latente en `src/app/panel/solicitudes/[id]/page.tsx:109`, `src/app/panel/agenda/page.tsx:65` y `:107`. En escritorio también: `1.4fr` equivale a `minmax(auto,1.4fr)`.
   - Cómo se arregla: `grid-cols-[minmax(0,1fr)]` en la base y `xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]` (o `min-w-0` en los hijos).

### MEDIA

3. **El formulario rechaza a quien deja solo Instagram.** La página dice "Escribime por Instagram" y pide el usuario, pero con nombre + idea + Instagram falla con "Dejá un email o un teléfono" (`src/server/requests/schemas.ts:34`). En tatuajes Instagram suele ser el canal principal → se pierden consultas. Arreglo: aceptar Instagram como contacto válido (`hasContact` con `instagramHandle`) y ajustar el texto del error.
4. **Errores del formulario fuera de la vista en celular.** Al enviar con errores el foco queda en `<body>` y la pantalla queda abajo, mostrando solo "Revisá los campos marcados"; el primer error ("Tu idea") está una pantalla más arriba. Además se anuncian 4 `role="alert"` a la vez. Dónde: `src/components/public/request-form.tsx:35-39` y `:108`; `src/components/ui/field.tsx:43`. Arreglo: en el `useEffect` de error, mover el foco al primer campo con `aria-invalid` y dejar `role="alert"` solo en el resumen.
5. **Página 404 genérica de Next en inglés y sin marca.** `/artist/noexiste` y un trabajo inexistente muestran "This page could not be found." No existe `src/app/not-found.tsx` ni `src/app/artist/[slug]/not-found.tsx`. Arreglo: crear 404 en español con botón "Volver a la página" / "Ver trabajos".

### BAJA

6. **Avisos de Next en desarrollo.** Consola: `Could not validate instant` en `/artist/[slug]` y `/work/[workId]` al llamar `notFound()` y "uncached data … outside of `<Suspense>`" en `/panel` (`getClaims` en `getPanelContext`), más `cacheComponents is enabled without partialPrefetching` (`next.config.ts:8`). No rompen nada visible, pero conviene revisarlos contra la guía de Next 16 (`node_modules/next/dist/docs/`) antes de producción y definir `partialPrefetching`.
7. **Menú con secciones que pueden no existir.** "Proceso" y "Preguntas" están fijos en `src/components/public/artist-header.tsx:7-12`, pero esas secciones solo se muestran si hay contenido (`page.tsx:189` y `:208`) → links muertos para un tatuador sin FAQ/proceso. Arreglo: pasar al header qué secciones existen.

---

## UI/UX

### ALTA

1. **Datos de contacto del cliente al final en el celular.** En el detalle de una solicitud (página de 2850 px en celular) WhatsApp e Instagram del cliente están al fondo (`src/app/panel/solicitudes/[id]/page.tsx:340`), después de notas, estado, presupuesto, pagos, turnos, controles y link. Es lo que más usa el tatuador. Arreglo: botón fijo o fila arriba (bajo el título) con "WhatsApp" e "Instagram" a un toque.
2. **Bordes de campos casi invisibles.** Los inputs usan `border-line` #2a2a2f sobre #111113 = **1,3:1**; en reposo los botones secundarios/chips usan `line-strong` #3b3b41 sobre #0a0a0b = **1,8:1**. WCAG pide 3:1 para bordes de controles (`src/components/ui/field.tsx:62,79,105`; `button.tsx:15`). En el celular, a pleno sol, no se ve dónde escribir. Arreglo: borde de campos ≥ #5a5a62 o fondo del campo más claro (`surface-2`/`surface-3`).
3. **Botones táctiles chicos.** Mínimo recomendado 44 px:
   - Página pública: "Iniciar proyecto" del header 36 px (`artist-header.tsx:37`, `size: "sm"`), chips de categoría 40 px (`portfolio-grid.tsx:168`), preguntas frecuentes: la parte tocable (`summary`) mide 27 px (`page.tsx:213`; el padding está en `details`), link "@tattoobyesti" 18 px.
   - Panel: todos los `size="sm"` miden 36 px (Agregar nota, Armar presupuesto, Registrar pago, Dar turno, etc.); en Portfolio las flechas ↑ ↓ y "Ocultar" (`work-card.tsx:70-84`).
   - Arreglo: `sm` → `h-11` en táctil (o `min-h-11` con `@media (pointer: coarse)`), `py-5` del FAQ pasarlo al `summary`.

### MEDIA

4. **La página del tatuador no se indexa en Google.** `robots: { index: false }` en `src/app/layout.tsx:22` aplica también a `/artist/[slug]` (su `generateMetadata` no lo pisa). Está comentado como temporal: decidirlo antes de lanzar, o pisarlo en la página pública.
5. **Sin turnos visibles si la agenda está vacía.** Si el tatuador no cargó horario (como ahora en local, 0 reglas), el formulario no muestra "Turno (opcional)" y nada lo avisa. En el Inicio del panel sumar un aviso "Cargá tu horario para que tus clientes pidan turno" con link a Agenda.
6. **Texto gris claro sobre tarjetas.** `fg-subtle` #8a857e sobre `surface-3` #202024 da 4,4:1 (justo debajo de 4,5). Se usa en ayudas y fechas de 12 px. Subir `fg-subtle` a ~#97928a.
7. **Hueco arriba al saltar a una sección.** `scroll-mt-20` (`section.tsx:15`) deja 80 px vacíos cuando el header se escondió al bajar (pasa al tocar "Quiero algo así" o "Iniciar mi proyecto"). Bajarlo a `scroll-mt-4` o mostrar el header al navegar por ancla.
8. **Badge de estado estirado a todo el ancho.** En el detalle de la solicitud en celular, "Nueva" ocupa una barra completa (`page.tsx:107`, dentro de un flex en columna). Agregar `self-start`.

### BAJA

9. **Sin "Saltar al contenido".** Existe `<main id="contenido">` pero ningún link que lo use (`src/app/artist/[slug]/page.tsx:53`).
10. **Ubicación que corta "BUENOS / AIRES".** El eyebrow en mayúsculas con tracking amplio parte la última palabra sola en 375 px (`page.tsx:58`). `text-balance` lo resuelve.
11. **Barra de scroll visible bajo los chips de categoría** en celular (`portfolio-grid.tsx:77`): ocultarla (`scrollbar-width: none`) o mostrar un degradé que indique que hay más.
12. **Íconos con caracteres de texto** (✕, ←, →, ↑, ↓, ✦, ▶) en vez de SVG; el panel ya tiene `icons.tsx`. Unificarlos.
13. **Menú de escritorio sin "Perfil"** aunque la sección `#sobre-mi` existe.

---

## Orden sugerido

1. Bug 1 (WhatsApp) y Bug 2 (desborde del panel): afectan el uso diario en el celular.
2. UI/UX 1–3 (contacto arriba, bordes, botones de 44 px).
3. Bugs 3–5 y UI/UX 4–8.
4. Los de prioridad baja cuando haya tiempo.

---

## Aplicado (2026-11-05, rama `diagnostico-arreglos`): todos los puntos

**Bugs**
- WhatsApp: `src/lib/phone.ts` normaliza a 549 + área + abonado (acepta "11 2233-4455", "011 15…", "+54 9…"; otros países con +). Links con `whatsappUrl` y números legibles con `formatPhone` en todo el panel. Migración `20261106010000_whatsapp_y_contacto_por_instagram.sql` corrige los teléfonos ya guardados (sin pisar duplicados).
- Grillas del panel con `minmax(0,…)`: inicio, ficha de cliente, solicitud, agenda, ajustes, portfolio. Verificado: 375 px sin scroll horizontal.
- Instagram cuenta como contacto (formulario, ficha de cliente y constraint de la base); los clientes también se reconocen por Instagram.
- Formulario: el foco va al primer campo con error y se anuncia un solo aviso.
- 404 en español: `src/app/not-found.tsx` y uno propio para trabajos que ya no están.
- Avisos de Next: `partialPrefetching: false` (comportamiento actual), `loading.tsx` en cada sección del panel (además muestra un esqueleto al navegar) y `connection()` antes de crear el cliente de Supabase con sesión. Queda solo el aviso de desarrollo "Could not validate instant" al mostrar un 404, que es de Next.
- Menú de la página pública según las secciones que existen (+ "Perfil").

**UI/UX**
- WhatsApp del estudio: columna `workspace_settings.whatsapp_phone`, editable en Ajustes; cargado +54 9 11 3129-1602 para Esti. Aparece en Contacto ("¿Preferís hablar directo?") y en Perfil.
- Detalle de solicitud: botones WhatsApp / Instagram / Email / Ver ficha arriba; el bloque de contacto del costado solo en escritorio. Badge de estado sin estirar.
- Bordes de campos `line-input` #6a6a73 (≥ 3:1); `fg-subtle` #97928a (≥ 5:1 en todas las superficies).
- Botones `sm` a 44 px en pantallas táctiles; chips, horarios, FAQ, header y links de Instagram/WhatsApp a 44 px.
- Página del tatuador indexable (`robots: index`); el resto sigue `noindex`.
- Aviso en Inicio cuando no hay horario cargado.
- Saltar al contenido, `text-balance` en la ubicación, chips sin barra de scroll, íconos SVG (`src/components/ui/icons.tsx`, engranaje real en Ajustes), el header se esconde al saltar a una sección (sin hueco arriba).

**Verificado:** lint, typecheck, 97 tests unitarios + 64 de integración, `pnpm build`, y recorrido en el navegador a 375 px y 1280 px. Datos de prueba en la base local: consultas "Prueba Diagnostico" y "Prueba Instagram".
