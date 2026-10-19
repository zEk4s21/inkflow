-- Fase 5.5: registro de los emails automáticos.
--
-- Cada aviso que INKFLOW intenta mandar queda anotado, se haya enviado o no: sin proveedor
-- configurado queda como "skipped", así el panel muestra qué se habría mandado y nunca se
-- finge un envío. No se guarda la dirección ni el contenido: solo a quién iba (rol), el tipo y
-- el resultado. Lo escribe el servidor con la clave secreta; los miembros lo leen.

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid references public.tattoo_requests (id) on delete set null,
  kind text not null constraint email_log_kind check (kind in ('new_request_artist', 'request_received_client')),
  recipient text not null constraint email_log_recipient check (recipient in ('artist', 'client')),
  status text not null constraint email_log_status check (status in ('sent', 'skipped', 'failed')),
  -- Id del proveedor (para buscarlo en su panel) o motivo corto del fallo. Nunca la clave.
  detail text constraint email_log_detail_length check (char_length(detail) <= 200),
  created_at timestamptz not null default now()
);

create index email_log_workspace_idx on public.email_log (workspace_id, created_at desc);

revoke all on public.email_log from anon, authenticated;
grant select on public.email_log to authenticated;

alter table public.email_log enable row level security;

create policy "Miembros leen el registro de emails" on public.email_log
  for select to authenticated using (private.is_member(workspace_id));
