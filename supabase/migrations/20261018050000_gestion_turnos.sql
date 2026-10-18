-- Fase 3.3: el tatuador confirma, rechaza, reprograma y cancela turnos, y da turnos a mano.
--
-- La superposición de turnos confirmados la sigue impidiendo la restricción de exclusión de la 3.2:
-- si dos personas confirman a la vez turnos que se pisan, Postgres acepta uno y rechaza el otro.
-- Acá se suman los permisos de escritura y un trigger que solo deja pasar cambios de estado válidos.

-- Privilegios: además de leer, owner o artista crean turnos a mano y cambian estado y horario.
-- Nadie mueve un turno de workspace, tatuador, cliente o solicitud desde la API.
grant insert (workspace_id, artist_id, client_id, request_id, period, buffer_minutes, status, source)
  on public.appointments to authenticated;
grant update (status, period, buffer_minutes) on public.appointments to authenticated;

create policy "Owner o artista dan turnos a mano" on public.appointments
  for insert to authenticated
  with check (
    private.has_role(workspace_id, array['owner', 'artist'])
    and source = 'manual'
    and status in ('requested', 'confirmed')
  );

create policy "Owner o artista gestionan los turnos" on public.appointments
  for update to authenticated
  using (private.has_role(workspace_id, array['owner', 'artist']))
  with check (private.has_role(workspace_id, array['owner', 'artist']));

-- requested → confirmed | cancelled (rechazado)
-- confirmed → cancelled | completed | no_show (estos dos, solo una vez que empezó)
-- cancelled, completed y no_show son finales. Solo se reprograma un turno pedido o confirmado.
create function private.check_appointment_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'El turno ya está cerrado' using errcode = 'check_violation';
  end if;
  if new.status <> old.status and not (
    (old.status = 'requested' and new.status in ('confirmed', 'cancelled'))
    or (old.status = 'confirmed' and new.status in ('cancelled', 'completed', 'no_show'))
  ) then
    raise exception 'Cambio de estado no permitido: % a %', old.status, new.status using errcode = 'check_violation';
  end if;
  if new.status in ('completed', 'no_show') and lower(new.period) > now() then
    raise exception 'El turno todavía no empezó' using errcode = 'check_violation';
  end if;
  if (new.period <> old.period or new.buffer_minutes <> old.buffer_minutes) and new.status not in ('requested', 'confirmed') then
    raise exception 'Solo se reprograma un turno pedido o confirmado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger appointments_check_change before update on public.appointments
  for each row execute function private.check_appointment_change();
