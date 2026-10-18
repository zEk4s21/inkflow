-- Fase 4.3: la persona confirma el resumen del Ink Assistant y se crea la consulta.
--
-- La consulta guarda los datos extra del resumen y apunta a la conversación, así el tatuador puede
-- leerla desde el panel. Una conversación genera como mucho una consulta (unique). La crea solo el
-- servidor con la clave secreta, después de que la persona tilda la confirmación: el modelo nunca
-- crea nada.

alter table public.tattoo_requests
  add column conversation_id uuid unique references public.conversations (id) on delete set null,
  add column style text constraint tattoo_requests_style_length check (char_length(style) <= 60),
  add column color_mode text constraint tattoo_requests_color_mode check (color_mode in ('black_grey', 'color')),
  add column is_cover_up boolean,
  add column details text constraint tattoo_requests_details_length check (char_length(details) <= 500);

-- La conversación tiene que ser del mismo estudio que la consulta.
create function private.check_request_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations c where c.id = new.conversation_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'La conversación no es de este estudio' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tattoo_requests_check_conversation
  before insert or update of conversation_id, workspace_id on public.tattoo_requests
  for each row execute function private.check_request_conversation();
