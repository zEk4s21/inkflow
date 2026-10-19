-- Fase 5.1: presupuestos de una solicitud.
--
-- Owner o artista arman el presupuesto (borrador), lo marcan como enviado cuando se lo pasan al
-- cliente y anotan la respuesta. Una solicitud tiene como mucho un presupuesto abierto (borrador
-- o enviado); si hay que cambiarlo después de enviado, se retira y se arma otro, así queda el
-- historial de lo que se le pasó al cliente. Los montos se guardan con la moneda del estudio.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.tattoo_requests (id) on delete cascade,
  amount numeric(12, 2) not null constraint quotes_amount_positive check (amount > 0),
  -- Seña para reservar el turno; null = sin seña.
  deposit numeric(12, 2) constraint quotes_deposit_range check (deposit >= 0 and deposit <= amount),
  currency text not null constraint quotes_currency check (currency ~ '^[A-Z]{3}$'),
  estimated_sessions smallint constraint quotes_sessions check (estimated_sessions between 1 and 20),
  valid_until date,
  -- Lo que lee el cliente junto con el monto (qué incluye, condiciones).
  message text constraint quotes_message_length check (char_length(message) <= 1000),
  status text not null default 'draft'
    constraint quotes_status check (status in ('draft', 'sent', 'accepted', 'rejected', 'withdrawn')),
  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_request_idx on public.quotes (request_id, created_at desc);
create unique index quotes_one_open_per_request on public.quotes (request_id) where status in ('draft', 'sent');

-- draft → sent | withdrawn; sent → accepted | rejected | withdrawn; el resto es final.
-- Montos y condiciones solo se editan en borrador: lo enviado no se reescribe.
create function private.check_quote_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.tattoo_requests r where r.id = new.request_id and r.workspace_id = new.workspace_id) then
      raise exception 'El presupuesto mezcla datos de otro workspace' using errcode = 'check_violation';
    end if;
    if new.status = 'sent' then new.sent_at := now(); end if;
    return new;
  end if;

  if new.workspace_id <> old.workspace_id or new.request_id <> old.request_id or new.currency <> old.currency then
    raise exception 'No se puede mover un presupuesto' using errcode = 'check_violation';
  end if;
  if old.status in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'El presupuesto ya está cerrado' using errcode = 'check_violation';
  end if;
  if new.status <> old.status and not (
    (old.status = 'draft' and new.status in ('sent', 'withdrawn'))
    or (old.status = 'sent' and new.status in ('accepted', 'rejected', 'withdrawn'))
  ) then
    raise exception 'Cambio de estado no permitido: % a %', old.status, new.status using errcode = 'check_violation';
  end if;
  if old.status <> 'draft' and (
    new.amount <> old.amount
    or new.deposit is distinct from old.deposit
    or new.estimated_sessions is distinct from old.estimated_sessions
    or new.valid_until is distinct from old.valid_until
    or new.message is distinct from old.message
  ) then
    raise exception 'Un presupuesto enviado no se edita: retiralo y armá otro' using errcode = 'check_violation';
  end if;
  if new.status = 'sent' and old.status = 'draft' then new.sent_at := now(); end if;
  if new.status in ('accepted', 'rejected') then new.responded_at := now(); end if;
  return new;
end;
$$;

create trigger quotes_check_change before insert or update on public.quotes
  for each row execute function private.check_quote_change();
create trigger quotes_updated_at before update on public.quotes
  for each row execute function private.set_updated_at();

-- La solicitud acompaña al presupuesto: enviado → "presupuestada" y aceptado → "aceptada", solo
-- si la solicitud venía antes en el circuito (no pisa un estado que el tatuador puso a mano).
-- Corre con los permisos de quien cambia el presupuesto, así el historial registra quién fue.
create function private.sync_request_with_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status <> 'sent') then
    update public.tattoo_requests set status = 'quoted'
     where id = new.request_id and status in ('new', 'reviewing', 'needs_info');
  elsif new.status = 'accepted' and old.status <> 'accepted' then
    update public.tattoo_requests set status = 'accepted'
     where id = new.request_id and status in ('new', 'reviewing', 'needs_info', 'quoted');
  end if;
  return null;
end;
$$;

create trigger quotes_sync_request after insert or update of status on public.quotes
  for each row execute function private.sync_request_with_quote();

revoke all on public.quotes from anon, authenticated;
grant select on public.quotes to authenticated;
grant insert (workspace_id, request_id, amount, deposit, currency, estimated_sessions, valid_until, message, status)
  on public.quotes to authenticated;
grant update (amount, deposit, estimated_sessions, valid_until, message, status) on public.quotes to authenticated;

alter table public.quotes enable row level security;

create policy "Miembros leen los presupuestos" on public.quotes
  for select to authenticated using (private.is_member(workspace_id));

create policy "Owner o artista arman presupuestos" on public.quotes
  for insert to authenticated
  with check (private.has_role(workspace_id, array['owner', 'artist']) and status in ('draft', 'sent'));

create policy "Owner o artista gestionan los presupuestos" on public.quotes
  for update to authenticated
  using (private.has_role(workspace_id, array['owner', 'artist']))
  with check (private.has_role(workspace_id, array['owner', 'artist']));
