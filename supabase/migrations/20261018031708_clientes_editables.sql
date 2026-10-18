-- Fase 2.7: editar clientes y unir duplicados.
--
-- La deduplicación automática (mismo email o teléfono) ya existe desde la 2.5. Acá se cubre el
-- caso que no puede detectar: la misma persona escribió una vez con email y otra con WhatsApp.

grant update (name, email, phone, instagram_handle) on public.clients to authenticated;

create policy "Owner o artista editan clientes" on public.clients
  for update to authenticated
  using (private.has_role(workspace_id, array['owner', 'artist']))
  with check (private.has_role(workspace_id, array['owner', 'artist']));

-- Une `source` dentro de `target`: mueve sus solicitudes, completa en `target` los datos de
-- contacto que le falten y da de baja `source` (borrado lógico). Todo en una transacción.
-- Es security definer porque mueve filas que la API no deja tocar (client_id, deleted_at);
-- por eso valida el rol del usuario antes de hacer nada.
create function public.merge_clients(source uuid, target uuid)
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

  -- Primero se da de baja el origen, así su email o teléfono quedan libres en los índices únicos.
  update public.clients set deleted_at = now() where id = src.id;
  update public.clients
  set email = coalesce(dst.email, src.email),
      phone = coalesce(dst.phone, src.phone),
      instagram_handle = coalesce(dst.instagram_handle, src.instagram_handle)
  where id = dst.id;
end;
$$;

revoke all on function public.merge_clients(uuid, uuid) from public, anon;
grant execute on function public.merge_clients(uuid, uuid) to authenticated;
