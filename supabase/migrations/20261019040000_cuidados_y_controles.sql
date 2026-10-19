-- Fase 5.4: cuidados y controles después de la sesión.
--
-- Cuidados: un texto por estudio que escribe el owner y que el cliente ve en su link cuando la
-- sesión ya se hizo. Son indicaciones generales del tatuador (como el proceso o las preguntas
-- frecuentes), así que se leen con la misma política que el resto de la configuración pública.
--
-- Controles: recordatorios para el tatuador (ver cómo cicatrizó, ofrecer retoque). Al marcar un
-- turno como realizado se crean dos solos (a los 7 y a los 30 días, en la fecha local del
-- estudio) y se pueden agregar otros a mano. INKFLOW no le escribe al cliente: el panel muestra
-- a quién contactar y el tatuador lo hace por su medio.

alter table public.workspace_settings
  add column care_instructions text
    constraint workspace_settings_care_length check (char_length(care_instructions) <= 4000);

grant update (care_instructions) on public.workspace_settings to authenticated;

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.tattoo_requests (id) on delete cascade,
  -- El turno realizado que lo originó; null si se cargó a mano.
  appointment_id uuid references public.appointments (id) on delete cascade,
  kind text not null constraint follow_ups_kind check (kind in ('healing_check', 'touch_up', 'custom')),
  due_on date not null,
  note text constraint follow_ups_note_length check (char_length(note) <= 300),
  done_at timestamptz,
  done_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint follow_ups_custom_note check (kind <> 'custom' or note is not null)
);

create index follow_ups_pending_idx on public.follow_ups (workspace_id, due_on) where done_at is null;
create index follow_ups_request_idx on public.follow_ups (request_id, due_on);
-- Un turno genera cada control automático una sola vez, aunque se reabra y se cierre.
create unique index follow_ups_one_per_appointment on public.follow_ups (appointment_id, kind) where appointment_id is not null;

create function private.check_follow_up_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.tattoo_requests r where r.id = new.request_id and r.workspace_id = new.workspace_id)
      or (new.appointment_id is not null and not exists (
        select 1 from public.appointments a where a.id = new.appointment_id and a.request_id = new.request_id
      ))
    then
      raise exception 'El control mezcla datos de otro workspace o solicitud' using errcode = 'check_violation';
    end if;
    if new.done_at is not null then
      raise exception 'Un control no se crea hecho' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.workspace_id <> old.workspace_id or new.request_id <> old.request_id
    or new.appointment_id is distinct from old.appointment_id or new.kind <> old.kind
  then
    raise exception 'No se puede mover un control' using errcode = 'check_violation';
  end if;
  -- Marcar o desmarcar como hecho: la fecha y quién lo hizo los pone la base.
  if new.done_at is not null and old.done_at is null then
    new.done_at := now();
    new.done_by := auth.uid();
  elsif new.done_at is null then
    new.done_by := null;
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;

create trigger follow_ups_check_change before insert or update on public.follow_ups
  for each row execute function private.check_follow_up_change();

-- Al pasar un turno ligado a una solicitud a "realizado", los dos controles de siempre. Corre con
-- los permisos de quien cierra el turno (owner o artista, igual que los controles).
create function private.schedule_follow_ups()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  local_day date;
begin
  if new.status = 'completed' and old.status <> 'completed' and new.request_id is not null then
    select (upper(new.period) at time zone coalesce(s.timezone, 'America/Argentina/Buenos_Aires'))::date
      into local_day
      from public.workspace_settings s where s.workspace_id = new.workspace_id;
    local_day := coalesce(local_day, (upper(new.period) at time zone 'America/Argentina/Buenos_Aires')::date);
    insert into public.follow_ups (workspace_id, request_id, appointment_id, kind, due_on)
    values
      (new.workspace_id, new.request_id, new.id, 'healing_check', local_day + 7),
      (new.workspace_id, new.request_id, new.id, 'touch_up', local_day + 30)
    on conflict (appointment_id, kind) where appointment_id is not null do nothing;
  end if;
  return null;
end;
$$;

create trigger appointments_schedule_follow_ups after update of status on public.appointments
  for each row execute function private.schedule_follow_ups();

revoke all on public.follow_ups from anon, authenticated;
grant select on public.follow_ups to authenticated;
grant insert (workspace_id, request_id, appointment_id, kind, due_on, note) on public.follow_ups to authenticated;
grant update (due_on, note, done_at) on public.follow_ups to authenticated;

alter table public.follow_ups enable row level security;

create policy "Miembros leen los controles" on public.follow_ups
  for select to authenticated using (private.is_member(workspace_id));

create policy "Owner o artista agregan controles" on public.follow_ups
  for insert to authenticated
  with check (private.has_role(workspace_id, array['owner', 'artist']));

create policy "Owner o artista gestionan los controles" on public.follow_ups
  for update to authenticated
  using (private.has_role(workspace_id, array['owner', 'artist']))
  with check (private.has_role(workspace_id, array['owner', 'artist']));
