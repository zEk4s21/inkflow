-- Fase 3.1: horarios de trabajo y bloqueos de cada tatuador.
--
-- - Los horarios son hora local por día de la semana (1 = lunes ... 7 = domingo). Se interpretan
--   con la zona horaria del workspace, así un cambio de horario oficial no corre los turnos.
-- - Cada franja define la duración de un turno y el margen entre turnos (limpieza, armado).
-- - Los bloqueos son rangos de tiempo absolutos (vacaciones, feriados, un trámite).
-- - Todavía nadie de afuera ve esto: el pedido de turno público llega en la 3.2.

-- btree_gist permite combinar uuid y rangos en un mismo índice GiST (y en la 3.3, la
-- restricción de exclusión que impide turnos superpuestos).
create extension if not exists btree_gist with schema extensions;

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artist_profiles (id) on delete cascade,
  weekday smallint not null constraint availability_rules_weekday check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 180
    constraint availability_rules_slot check (slot_minutes between 30 and 720),
  buffer_minutes integer not null default 30
    constraint availability_rules_buffer check (buffer_minutes between 0 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_rules_range check (end_time > start_time)
);

create index availability_rules_artist_idx on public.availability_rules (artist_id, weekday, start_time);

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid not null references public.artist_profiles (id) on delete cascade,
  period tstzrange not null
    constraint availability_blocks_period check (not isempty(period) and not lower_inf(period) and not upper_inf(period)),
  reason text constraint availability_blocks_reason_length check (char_length(reason) <= 120),
  created_at timestamptz not null default now()
);

create index availability_blocks_artist_idx on public.availability_blocks using gist (artist_id, period);

create trigger availability_rules_updated_at before update on public.availability_rules
  for each row execute function private.set_updated_at();

-- El tatuador tiene que ser del mismo workspace.
create function private.validate_artist_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.artist_profiles a where a.id = new.artist_id and a.workspace_id = new.workspace_id
  ) then
    raise exception 'El tatuador no pertenece al workspace' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger availability_rules_validate_artist before insert or update on public.availability_rules
  for each row execute function private.validate_artist_workspace();
create trigger availability_blocks_validate_artist before insert or update on public.availability_blocks
  for each row execute function private.validate_artist_workspace();

-- Privilegios y RLS -----------------------------------------------------------------

revoke all on public.availability_rules, public.availability_blocks from anon, authenticated;
grant select, delete on public.availability_rules, public.availability_blocks to authenticated;
grant insert (workspace_id, artist_id, weekday, start_time, end_time, slot_minutes, buffer_minutes)
  on public.availability_rules to authenticated;
grant insert (workspace_id, artist_id, period, reason) on public.availability_blocks to authenticated;

alter table public.availability_rules enable row level security;
alter table public.availability_blocks enable row level security;

create policy "Miembros leen los horarios" on public.availability_rules
  for select to authenticated using (private.is_member(workspace_id));
create policy "Owner o artista cargan horarios" on public.availability_rules
  for insert to authenticated with check (private.has_role(workspace_id, array['owner', 'artist']));
create policy "Owner o artista borran horarios" on public.availability_rules
  for delete to authenticated using (private.has_role(workspace_id, array['owner', 'artist']));

create policy "Miembros leen los bloqueos" on public.availability_blocks
  for select to authenticated using (private.is_member(workspace_id));
create policy "Owner o artista cargan bloqueos" on public.availability_blocks
  for insert to authenticated with check (private.has_role(workspace_id, array['owner', 'artist']));
create policy "Owner o artista borran bloqueos" on public.availability_blocks
  for delete to authenticated using (private.has_role(workspace_id, array['owner', 'artist']));

-- Funciones -------------------------------------------------------------------------
-- Las dos corren con los permisos de quien llama (security invoker): la RLS se aplica igual.

-- Reemplaza el horario semanal completo de un tatuador en una sola transacción.
-- `rules`: [{"weekday":1,"start_time":"10:00","end_time":"18:00","slot_minutes":180,"buffer_minutes":30}, ...]
create function public.set_weekly_availability(target_artist uuid, rules jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  target_workspace uuid;
begin
  select workspace_id into target_workspace from public.artist_profiles where id = target_artist;
  if target_workspace is null or not private.has_role(target_workspace, array['owner', 'artist']) then
    raise exception 'Sin permiso' using errcode = 'insufficient_privilege';
  end if;

  delete from public.availability_rules where artist_id = target_artist;
  insert into public.availability_rules (workspace_id, artist_id, weekday, start_time, end_time, slot_minutes, buffer_minutes)
  select target_workspace, target_artist, r.weekday, r.start_time, r.end_time, r.slot_minutes, r.buffer_minutes
  from jsonb_to_recordset(coalesce(rules, '[]'::jsonb))
    as r (weekday smallint, start_time time, end_time time, slot_minutes integer, buffer_minutes integer);

  -- Dos franjas del mismo día no se pueden pisar.
  if exists (
    select 1
    from public.availability_rules a
    join public.availability_rules b
      on a.artist_id = b.artist_id and a.weekday = b.weekday and a.id < b.id
     and a.start_time < b.end_time and b.start_time < a.end_time
    where a.artist_id = target_artist
  ) then
    raise exception 'Hay franjas que se superponen' using errcode = 'check_violation';
  end if;
end;
$$;

-- Agrega un bloqueo a partir de fechas y horas locales del workspace. Sin horas, son días completos
-- (desde las 00:00 del primer día hasta las 00:00 del día siguiente al último).
create function public.add_availability_block(
  target_artist uuid,
  start_date date,
  end_date date,
  start_time time default null,
  end_time time default null,
  reason text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target_workspace uuid;
  tz text;
  starts timestamptz;
  ends timestamptz;
  new_id uuid;
begin
  select a.workspace_id, coalesce(s.timezone, 'America/Argentina/Buenos_Aires')
    into target_workspace, tz
  from public.artist_profiles a
  left join public.workspace_settings s on s.workspace_id = a.workspace_id
  where a.id = target_artist;
  if target_workspace is null or not private.has_role(target_workspace, array['owner', 'artist']) then
    raise exception 'Sin permiso' using errcode = 'insufficient_privilege';
  end if;

  starts := (start_date + coalesce(start_time, time '00:00')) at time zone tz;
  ends := case
    when end_time is null then ((end_date + 1) + time '00:00') at time zone tz
    else (end_date + end_time) at time zone tz
  end;
  if ends <= starts then
    raise exception 'El bloqueo termina antes de empezar' using errcode = 'check_violation';
  end if;

  insert into public.availability_blocks (workspace_id, artist_id, period, reason)
  values (target_workspace, target_artist, tstzrange(starts, ends, '[)'), nullif(btrim(reason), ''))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.set_weekly_availability(uuid, jsonb) from public, anon;
revoke all on function public.add_availability_block(uuid, date, date, time, time, text) from public, anon;
grant execute on function public.set_weekly_availability(uuid, jsonb) to authenticated;
grant execute on function public.add_availability_block(uuid, date, date, time, time, text) to authenticated;
