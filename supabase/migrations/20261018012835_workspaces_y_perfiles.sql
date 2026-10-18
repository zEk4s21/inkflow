-- Fase 2.1: tenant (workspaces), miembros, configuración y perfiles de artista.
--
-- Reglas de acceso (ver docs/SECURITY.md):
-- - Altas y bajas de workspaces y miembros solo con la clave secreta (onboarding manual).
-- - Los miembros leen todo lo de su workspace; solo el owner edita workspace y configuración.
-- - El owner o el propio artista editan su perfil.
-- - Cualquiera (anon) lee workspaces, configuración y perfiles de un artista publicado.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- updated_at automático ------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tablas ---------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  -- Va en la URL pública: /artist/<slug>
  slug text not null unique
    constraint workspaces_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null
    constraint workspaces_name_length check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null
    constraint workspace_members_role check (role in ('owner', 'artist', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  locale text not null default 'es-AR'
    constraint workspace_settings_locale_format check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  currency text not null default 'ARS'
    constraint workspace_settings_currency_format check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  location_label text
    constraint workspace_settings_location_length check (char_length(location_label) <= 120),
  instagram_handle text
    constraint workspace_settings_instagram_format check (instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  -- [{ "title": text, "description": text }]
  process jsonb not null default '[]'::jsonb
    constraint workspace_settings_process_array check (jsonb_typeof(process) = 'array'),
  -- [{ "question": text, "answer": text }]
  faq jsonb not null default '[]'::jsonb
    constraint workspace_settings_faq_array check (jsonb_typeof(faq) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artist_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null mientras el artista no tenga cuenta (perfil cargado por el owner).
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null
    constraint artist_profiles_display_name_length check (char_length(display_name) between 1 and 60),
  full_name text
    constraint artist_profiles_full_name_length check (char_length(full_name) <= 120),
  bio text
    constraint artist_profiles_bio_length check (char_length(bio) <= 2000),
  styles text[] not null default '{}'
    constraint artist_profiles_styles_count check (cardinality(styles) <= 12),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, user_id)
);

create index artist_profiles_workspace_id_idx on public.artist_profiles (workspace_id);

-- Zona horaria válida (no se puede validar con CHECK porque consulta un catálogo).
create function private.validate_workspace_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria inválida: %', new.timezone
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger workspace_settings_validate
  before insert or update of timezone on public.workspace_settings
  for each row execute function private.validate_workspace_settings();

create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger workspace_members_updated_at before update on public.workspace_members
  for each row execute function private.set_updated_at();
create trigger workspace_settings_updated_at before update on public.workspace_settings
  for each row execute function private.set_updated_at();
create trigger artist_profiles_updated_at before update on public.artist_profiles
  for each row execute function private.set_updated_at();

-- Funciones de autorización ---------------------------------------------------
-- security definer para leer workspace_members sin pasar por su propia RLS (evita recursión).

create function private.member_role(target_workspace uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.workspace_id = target_workspace
    and m.user_id = (select auth.uid())
    and w.deleted_at is null
$$;

create function private.is_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.member_role(target_workspace) is not null
$$;

create function private.has_role(target_workspace uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.member_role(target_workspace) = any (roles), false)
$$;

-- Un workspace es público si está activo y tiene al menos un perfil publicado.
create function private.is_public_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    join public.artist_profiles p on p.workspace_id = w.id
    where w.id = target_workspace
      and w.deleted_at is null
      and p.is_public
      and p.deleted_at is null
  )
$$;

revoke all on all functions in schema private from public;
grant execute on function private.member_role(uuid) to anon, authenticated;
grant execute on function private.is_member(uuid) to anon, authenticated;
grant execute on function private.has_role(uuid, text[]) to anon, authenticated;
grant execute on function private.is_public_workspace(uuid) to anon, authenticated;

-- Privilegios por columna -----------------------------------------------------
-- Además de RLS: anon solo lee columnas públicas y nadie escribe claves ni timestamps.

revoke all on public.workspaces, public.workspace_members, public.workspace_settings,
  public.artist_profiles from anon, authenticated;

grant select (id, slug, name) on public.workspaces to anon;
grant select on public.workspaces to authenticated;
grant update (slug, name) on public.workspaces to authenticated;

grant select on public.workspace_members to authenticated;

grant select on public.workspace_settings to anon, authenticated;
grant update (locale, currency, timezone, location_label, instagram_handle, process, faq)
  on public.workspace_settings to authenticated;

grant select (id, workspace_id, display_name, full_name, bio, styles, is_public)
  on public.artist_profiles to anon;
grant select on public.artist_profiles to authenticated;
grant update (display_name, full_name, bio, styles, is_public)
  on public.artist_profiles to authenticated;

-- RLS -------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.artist_profiles enable row level security;

create policy "Miembros leen su workspace" on public.workspaces
  for select to authenticated
  using (private.is_member(id));

create policy "Cualquiera lee workspaces públicos" on public.workspaces
  for select to anon, authenticated
  using (private.is_public_workspace(id));

create policy "Owner edita su workspace" on public.workspaces
  for update to authenticated
  using (private.has_role(id, array['owner']))
  with check (private.has_role(id, array['owner']));

create policy "Miembros ven a su equipo" on public.workspace_members
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Miembros leen la configuración" on public.workspace_settings
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Cualquiera lee la configuración pública" on public.workspace_settings
  for select to anon, authenticated
  using (private.is_public_workspace(workspace_id));

create policy "Owner edita la configuración" on public.workspace_settings
  for update to authenticated
  using (private.has_role(workspace_id, array['owner']))
  with check (private.has_role(workspace_id, array['owner']));

create policy "Miembros leen los perfiles" on public.artist_profiles
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Cualquiera lee perfiles publicados" on public.artist_profiles
  for select to anon, authenticated
  using (is_public and deleted_at is null and private.is_public_workspace(workspace_id));

create policy "Owner o el propio artista editan el perfil" on public.artist_profiles
  for update to authenticated
  using (
    private.has_role(workspace_id, array['owner'])
    or (user_id = (select auth.uid()) and private.is_member(workspace_id))
  )
  with check (
    private.has_role(workspace_id, array['owner'])
    or (user_id = (select auth.uid()) and private.is_member(workspace_id))
  );
