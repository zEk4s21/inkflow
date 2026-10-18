-- Datos de desarrollo local (se cargan con `pnpm db:reset`). Nunca se aplican en producción.
-- Workspace de Esti con datos públicos de @tattoobyesti. Sin usuarios: los miembros se crean
-- en la Fase 2.2 junto con el login.

insert into public.workspaces (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'esti', 'Esti Tattoo');

insert into public.workspace_settings (workspace_id, location_label, instagram_handle)
values (
  '00000000-0000-4000-8000-000000000001',
  'Estudio privado · Banfield, Buenos Aires',
  'tattoobyesti'
);

insert into public.artist_profiles (workspace_id, display_name, full_name, styles, is_public)
values (
  '00000000-0000-4000-8000-000000000001',
  'Esti',
  'Esteban Fernández',
  array['Black & Grey', 'Puntillismo de arrastre', 'Blackwork'],
  true
);
