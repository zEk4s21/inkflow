-- Fase 2.6: estados de las solicitudes, historial de cambios y notas privadas.
--
-- - Owner y artista cambian el estado; staff solo mira. Se puede pasar de cualquier estado a
--   cualquier otro (en un estudio chico los pasos no siempre siguen un orden).
-- - El historial lo escribe un trigger: nadie puede insertarlo ni editarlo desde la API.
-- - Las notas son internas del estudio. Nunca se exponen en rutas públicas.

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.tattoo_requests (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index request_status_history_request_idx
  on public.request_status_history (request_id, created_at);

create table public.request_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.tattoo_requests (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  body text not null
    constraint request_notes_body_length check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index request_notes_request_idx
  on public.request_notes (request_id, created_at)
  where deleted_at is null;

create trigger request_notes_updated_at before update on public.request_notes
  for each row execute function private.set_updated_at();

-- Cada cambio de estado deja una fila en el historial, con quién lo hizo.
create function private.log_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.request_status_history (workspace_id, request_id, from_status, to_status, changed_by)
  values (new.workspace_id, new.id, old.status, new.status, auth.uid());
  return new;
end;
$$;

create trigger tattoo_requests_log_status
  after update of status on public.tattoo_requests
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_request_status();

-- La nota tiene que ser de una solicitud del mismo workspace.
create function private.validate_note_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tattoo_requests r where r.id = new.request_id and r.workspace_id = new.workspace_id
  ) then
    raise exception 'La solicitud no pertenece al workspace' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger request_notes_validate_request
  before insert on public.request_notes
  for each row execute function private.validate_note_request();

-- Privilegios ----------------------------------------------------------------------

grant update (status) on public.tattoo_requests to authenticated;

revoke all on public.request_status_history, public.request_notes from anon, authenticated;
grant select on public.request_status_history, public.request_notes to authenticated;
grant insert (workspace_id, request_id, body) on public.request_notes to authenticated;
-- Borrar una nota es borrado lógico (deleted_at).
grant update (deleted_at) on public.request_notes to authenticated;

-- RLS ------------------------------------------------------------------------------

create policy "Owner o artista cambian el estado" on public.tattoo_requests
  for update to authenticated
  using (private.has_role(workspace_id, array['owner', 'artist']))
  with check (private.has_role(workspace_id, array['owner', 'artist']));

alter table public.request_status_history enable row level security;
alter table public.request_notes enable row level security;

create policy "Miembros leen el historial" on public.request_status_history
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Miembros leen las notas" on public.request_notes
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Owner o artista escriben notas" on public.request_notes
  for insert to authenticated
  with check (private.has_role(workspace_id, array['owner', 'artist']) and author_id = (select auth.uid()));

create policy "Cada uno borra sus notas" on public.request_notes
  for update to authenticated
  using (author_id = (select auth.uid()) and private.has_role(workspace_id, array['owner', 'artist']))
  with check (author_id = (select auth.uid()) and private.has_role(workspace_id, array['owner', 'artist']));
