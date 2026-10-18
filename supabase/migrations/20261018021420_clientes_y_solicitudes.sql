-- Fase 2.5: clientes y solicitudes de tatuaje.
--
-- Las solicitudes llegan desde el formulario público. El navegador nunca escribe directo:
-- la Server Action valida captcha y límite de envíos y recién ahí inserta con la clave
-- secreta. Por eso anon no tiene ningún privilegio sobre estas tablas.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null
    constraint clients_name_length check (char_length(name) between 1 and 120),
  email text
    constraint clients_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  -- Solo dígitos, con código de país si lo puso (ej. 5491122334455).
  phone text
    constraint clients_phone_format check (phone ~ '^[0-9]{6,15}$'),
  instagram_handle text
    constraint clients_instagram_format check (instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clients_contact_required check (email is not null or phone is not null)
);

-- Deduplicación: un mismo email o teléfono es un mismo cliente dentro del workspace.
create unique index clients_workspace_email_key
  on public.clients (workspace_id, lower(email))
  where email is not null and deleted_at is null;
create unique index clients_workspace_phone_key
  on public.clients (workspace_id, phone)
  where phone is not null and deleted_at is null;

create table public.tattoo_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Sin "on delete restrict": con restrict, borrar el workspace (cascada a clientes y solicitudes)
  -- fallaría según el orden de la cascada. "no action" se chequea al final de la sentencia.
  client_id uuid not null references public.clients (id),
  status text not null default 'new'
    constraint tattoo_requests_status check (
      status in ('new', 'reviewing', 'needs_info', 'quoted', 'accepted', 'rejected', 'completed', 'cancelled')
    ),
  source text not null default 'form'
    constraint tattoo_requests_source check (source in ('form', 'assistant', 'manual')),
  idea text not null
    constraint tattoo_requests_idea_length check (char_length(idea) between 10 and 3000),
  body_zone text
    constraint tattoo_requests_body_zone_length check (char_length(body_zone) <= 60),
  size_label text
    constraint tattoo_requests_size_length check (char_length(size_label) <= 60),
  -- HMAC de la IP de quien envió el formulario: alcanza para limitar envíos sin guardar la IP.
  submitter_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tattoo_requests_listing_idx
  on public.tattoo_requests (workspace_id, status, created_at desc)
  where deleted_at is null;
create index tattoo_requests_rate_limit_idx
  on public.tattoo_requests (submitter_hash, created_at desc);
create index tattoo_requests_client_idx on public.tattoo_requests (client_id);

-- El cliente de una solicitud tiene que ser del mismo workspace.
create function private.validate_request_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clients c where c.id = new.client_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'El cliente no pertenece al workspace' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tattoo_requests_validate_client
  before insert or update of client_id, workspace_id on public.tattoo_requests
  for each row execute function private.validate_request_client();

create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();
create trigger tattoo_requests_updated_at before update on public.tattoo_requests
  for each row execute function private.set_updated_at();

-- Privilegios: anon nada; los miembros leen. La edición llega en las Fases 2.6 y 2.7.

revoke all on public.clients, public.tattoo_requests from anon, authenticated;
grant select on public.clients, public.tattoo_requests to authenticated;

alter table public.clients enable row level security;
alter table public.tattoo_requests enable row level security;

create policy "Miembros leen sus clientes" on public.clients
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Miembros leen sus solicitudes" on public.tattoo_requests
  for select to authenticated
  using (private.is_member(workspace_id));
