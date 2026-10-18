-- Datos de desarrollo local (se cargan con `pnpm db:reset`). Nunca se aplican en producción.
-- Workspace de Esti con datos públicos de @tattoobyesti. Sin usuarios: los miembros se crean
-- en la Fase 2.2 junto con el login.

insert into public.workspaces (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'esti', 'Esti Tattoo');

-- Proceso y FAQ: textos provisorios, a confirmar con Esteban.
insert into public.workspace_settings (workspace_id, location_label, instagram_handle, process, faq)
values (
  '00000000-0000-4000-8000-000000000001',
  'Estudio privado · Banfield, Buenos Aires',
  'tattoobyesti',
  '[{"title": "Contás tu idea", "description": "Qué te querés tatuar, en qué zona y de qué tamaño. Si tenés referencias, mejor."}, {"title": "Evaluación", "description": "Se revisa la idea y se define si es viable o si conviene ajustarla."}, {"title": "Diseño y presupuesto", "description": "Se acuerdan el diseño, la cantidad de sesiones y el presupuesto."}, {"title": "Reserva", "description": "Con la seña confirmada, el turno queda reservado."}, {"title": "Sesión", "description": "Se realiza la sesión en el estudio, en el turno acordado."}, {"title": "Cuidados", "description": "Recibís las indicaciones de cuidado para la cicatrización."}]'::jsonb,
  '[{"question": "¿Cómo pido un turno?", "answer": "Contá tu idea desde el formulario de contacto. Con esa información se evalúa el proyecto y se coordina el turno."}, {"question": "¿Qué tengo que mandar para presentar una idea?", "answer": "Una descripción de la idea, la zona del cuerpo, el tamaño aproximado y, si tenés, imágenes de referencia."}, {"question": "¿Cómo se calcula el presupuesto?", "answer": "Depende del tamaño, el nivel de detalle, la zona y la cantidad de sesiones. Siempre se confirma antes de reservar."}, {"question": "¿Cómo funciona la seña?", "answer": "La seña reserva el turno y se descuenta del total. Las condiciones exactas se informan al confirmar."}, {"question": "¿Qué pasa si tengo que reprogramar?", "answer": "Avisá con anticipación y se busca una nueva fecha. Las condiciones se acuerdan al reservar."}]'::jsonb
);

insert into public.artist_profiles (workspace_id, display_name, full_name, styles, is_public)
values (
  '00000000-0000-4000-8000-000000000001',
  'Esti',
  'Esteban Fernández',
  array['Black & Grey', 'Puntillismo de arrastre', 'Blackwork'],
  true
);
