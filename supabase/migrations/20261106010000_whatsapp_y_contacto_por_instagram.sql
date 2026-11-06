-- 1. Teléfonos de clientes en formato internacional (wa.me necesita 54 9 + área + abonado).
--    Hasta ahora el formulario guardaba "1122334455" tal como lo escribía el cliente y los
--    links de WhatsApp abrían un número de otro país. Se completan solo los números argentinos
--    sin ambigüedad y nunca si el resultado choca con otro cliente del mismo estudio.
update public.clients as c
set phone = '549' || regexp_replace(c.phone, '^(54|0)', '')
where c.deleted_at is null
  and c.phone ~ '^(54|0)?[1-3][0-9]{9}$'
  and not exists (
    select 1
    from public.clients as other
    where other.workspace_id = c.workspace_id
      and other.deleted_at is null
      and other.id <> c.id
      and other.phone = '549' || regexp_replace(c.phone, '^(54|0)', '')
  );

-- 2. Instagram también cuenta como dato de contacto: muchos clientes solo escriben por ahí.
alter table public.clients drop constraint clients_contact_required;
alter table public.clients
  add constraint clients_contact_required
  check (email is not null or phone is not null or instagram_handle is not null);

-- 3. WhatsApp del estudio, visible en la página pública. Mismo formato que clients.phone.
alter table public.workspace_settings
  add column whatsapp_phone text
    constraint workspace_settings_whatsapp_format check (whatsapp_phone ~ '^[0-9]{6,15}$');

grant update (whatsapp_phone) on public.workspace_settings to authenticated;

-- WhatsApp de Esti (54 11 3129-1602). Solo si el estudio existe y todavía no cargó uno.
update public.workspace_settings
set whatsapp_phone = '5491131291602'
where whatsapp_phone is null
  and workspace_id = (select id from public.workspaces where slug = 'esti');
