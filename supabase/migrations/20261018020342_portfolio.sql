-- Fase 2.4: portfolio administrable.
--
-- Decisiones (ver docs/DATABASE.md):
-- - Una foto por trabajo (image_* en portfolio_items). Varias fotos por trabajo queda para después.
-- - La categoría es texto libre en el trabajo; los filtros públicos salen de los trabajos publicados.
-- - Fotos en el bucket público "portfolio", en <workspace_id>/<archivo>. Al borrar un trabajo se
--   borra también la foto, para que deje de estar accesible por URL.

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null
    constraint portfolio_items_title_length check (char_length(title) between 1 and 80),
  description text
    constraint portfolio_items_description_length check (char_length(description) <= 600),
  category text not null
    constraint portfolio_items_category_length check (char_length(category) between 1 and 40),
  body_zone text
    constraint portfolio_items_body_zone_length check (char_length(body_zone) <= 40),
  status text not null default 'draft'
    constraint portfolio_items_status check (status in ('draft', 'published')),
  position integer not null default 0,
  image_path text not null unique,
  image_width integer not null constraint portfolio_items_image_width check (image_width > 0),
  image_height integer not null constraint portfolio_items_image_height check (image_height > 0),
  alt_text text not null
    constraint portfolio_items_alt_length check (char_length(alt_text) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- La foto tiene que estar en la carpeta del propio workspace.
  constraint portfolio_items_image_in_workspace check (image_path like workspace_id::text || '/%')
);

create index portfolio_items_listing_idx
  on public.portfolio_items (workspace_id, status, position)
  where deleted_at is null;

create trigger portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function private.set_updated_at();

-- Privilegios por columna --------------------------------------------------------

revoke all on public.portfolio_items from anon, authenticated;

grant select (id, workspace_id, title, description, category, body_zone, status, position,
  image_path, image_width, image_height, alt_text) on public.portfolio_items to anon;
grant select on public.portfolio_items to authenticated;
grant insert (workspace_id, title, description, category, body_zone, status, position,
  image_path, image_width, image_height, alt_text) on public.portfolio_items to authenticated;
grant update (title, description, category, body_zone, status, position, alt_text, deleted_at)
  on public.portfolio_items to authenticated;

-- RLS ----------------------------------------------------------------------------

alter table public.portfolio_items enable row level security;

create policy "Miembros leen el portfolio" on public.portfolio_items
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Cualquiera lee trabajos publicados" on public.portfolio_items
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null and private.is_public_workspace(workspace_id));

create policy "Owner o artista cargan trabajos" on public.portfolio_items
  for insert to authenticated
  with check (private.has_role(workspace_id, array['owner', 'artist']));

create policy "Owner o artista editan trabajos" on public.portfolio_items
  for update to authenticated
  using (private.has_role(workspace_id, array['owner', 'artist']))
  with check (private.has_role(workspace_id, array['owner', 'artist']));

-- Storage ------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

-- Workspace dueño de un objeto según su primera carpeta; null si no es un uuid.
create function private.storage_workspace(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function private.storage_workspace(text) from public;
grant execute on function private.storage_workspace(text) to authenticated;

-- El bucket es público para leer por URL; estas políticas cubren la API de Storage.
create policy "Miembros listan fotos del portfolio" on storage.objects
  for select to authenticated
  using (bucket_id = 'portfolio' and private.is_member(private.storage_workspace(name)));

create policy "Owner o artista suben fotos del portfolio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio'
    and private.has_role(private.storage_workspace(name), array['owner', 'artist'])
  );

create policy "Owner o artista borran fotos del portfolio" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portfolio'
    and private.has_role(private.storage_workspace(name), array['owner', 'artist'])
  );
