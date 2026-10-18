-- Fase 3.2: turnos. Un cliente pide un turno desde la página pública y queda "requested":
-- nunca se reserva solo. Confirmar, rechazar y reprogramar llega en la 3.3.
--
-- La restricción de exclusión impide dos turnos CONFIRMADOS superpuestos del mismo tatuador,
-- contando el margen entre turnos. La garantiza Postgres, así que dos confirmaciones simultáneas
-- no pueden pisarse. Los pedidos ("requested") sí pueden coincidir: decide el tatuador.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artist_profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  request_id uuid references public.tattoo_requests (id),
  period tstzrange not null
    constraint appointments_period check (not isempty(period) and not lower_inf(period) and not upper_inf(period)),
  buffer_minutes integer not null default 0
    constraint appointments_buffer check (buffer_minutes between 0 and 240),
  -- period + margen; lo mantiene un trigger (timestamptz + interval no es inmutable para una columna generada).
  blocked_period tstzrange not null default 'empty',
  status text not null default 'requested'
    constraint appointments_status check (status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
  source text not null default 'form'
    constraint appointments_source check (source in ('form', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_no_overlap exclude using gist (artist_id with =, blocked_period with &&)
    where (status = 'confirmed')
);

create index appointments_artist_period_idx on public.appointments using gist (artist_id, blocked_period);
create index appointments_request_idx on public.appointments (request_id);

create function private.prepare_appointment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.artist_profiles a where a.id = new.artist_id and a.workspace_id = new.workspace_id)
    or not exists (select 1 from public.clients c where c.id = new.client_id and c.workspace_id = new.workspace_id)
    or (new.request_id is not null and not exists (
      select 1 from public.tattoo_requests r where r.id = new.request_id and r.workspace_id = new.workspace_id
    ))
  then
    raise exception 'El turno mezcla datos de otro workspace' using errcode = 'check_violation';
  end if;
  new.blocked_period := tstzrange(lower(new.period), upper(new.period) + make_interval(mins => new.buffer_minutes), '[)');
  return new;
end;
$$;

create trigger appointments_prepare before insert or update of period, buffer_minutes, artist_id, client_id, request_id, workspace_id
  on public.appointments for each row execute function private.prepare_appointment();
create trigger appointments_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();

-- Privilegios: anon nada (los pedidos públicos entran por la Server Action con la clave secreta,
-- después de captcha, límite de envíos y de verificar que el turno esté libre). Miembros leen.
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;

alter table public.appointments enable row level security;

create policy "Miembros leen los turnos" on public.appointments
  for select to authenticated using (private.is_member(workspace_id));

-- Unir clientes también mueve sus turnos (misma función que en la 2.7, con una línea más).
create or replace function public.merge_clients(source uuid, target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.clients;
  dst public.clients;
begin
  if source = target then
    raise exception 'No se puede unir un cliente consigo mismo' using errcode = 'check_violation';
  end if;

  select * into src from public.clients where id = source and deleted_at is null for update;
  select * into dst from public.clients where id = target and deleted_at is null for update;
  if src.id is null or dst.id is null or src.workspace_id <> dst.workspace_id then
    raise exception 'Cliente no encontrado' using errcode = 'no_data_found';
  end if;
  if not private.has_role(src.workspace_id, array['owner', 'artist']) then
    raise exception 'Sin permiso' using errcode = 'insufficient_privilege';
  end if;

  update public.tattoo_requests set client_id = dst.id where client_id = src.id;
  update public.appointments set client_id = dst.id where client_id = src.id;

  -- Primero se da de baja el origen, así su email o teléfono quedan libres en los índices únicos.
  update public.clients set deleted_at = now() where id = src.id;
  update public.clients
  set email = coalesce(dst.email, src.email),
      phone = coalesce(dst.phone, src.phone),
      instagram_handle = coalesce(dst.instagram_handle, src.instagram_handle)
  where id = dst.id;
end;
$$;
