-- Fase 5.3: pagos registrados a mano (seña, pagos y devoluciones). INKFLOW no cobra: el tatuador
-- anota lo que recibió por efectivo, transferencia u otro medio.
--
-- Un pago no se edita: si se cargó mal, se anula (queda en el historial, tachado) y se carga de
-- nuevo. Así el saldo siempre se puede reconstruir y no hay montos que cambien sin rastro.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.tattoo_requests (id) on delete cascade,
  amount numeric(12, 2) not null constraint payments_amount_positive check (amount > 0),
  currency text not null constraint payments_currency check (currency ~ '^[A-Z]{3}$'),
  -- refund resta del total cobrado.
  kind text not null constraint payments_kind check (kind in ('deposit', 'payment', 'refund')),
  method text not null constraint payments_method check (method in ('cash', 'transfer', 'card', 'mercadopago', 'other')),
  paid_on date not null,
  note text constraint payments_note_length check (char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid
);

create index payments_request_idx on public.payments (request_id, paid_on desc, created_at desc);

create function private.check_payment_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.tattoo_requests r where r.id = new.request_id and r.workspace_id = new.workspace_id) then
      raise exception 'El pago mezcla datos de otro workspace' using errcode = 'check_violation';
    end if;
    if new.voided_at is not null then
      raise exception 'Un pago no se crea anulado' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Lo único que cambia es la anulación, y una sola vez.
  if old.voided_at is not null or new.voided_at is null
    or (to_jsonb(new) - array['voided_at', 'voided_by']) <> (to_jsonb(old) - array['voided_at', 'voided_by'])
  then
    raise exception 'Un pago no se edita: anulalo y cargalo de nuevo' using errcode = 'check_violation';
  end if;
  new.voided_at := now();
  new.voided_by := auth.uid();
  return new;
end;
$$;

create trigger payments_check_change before insert or update on public.payments
  for each row execute function private.check_payment_change();

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant insert (workspace_id, request_id, amount, currency, kind, method, paid_on, note) on public.payments to authenticated;
grant update (voided_at) on public.payments to authenticated;

alter table public.payments enable row level security;

create policy "Miembros leen los pagos" on public.payments
  for select to authenticated using (private.is_member(workspace_id));

create policy "Owner o artista registran pagos" on public.payments
  for insert to authenticated
  with check (private.has_role(workspace_id, array['owner', 'artist']));

create policy "Owner o artista anulan pagos" on public.payments
  for update to authenticated
  using (private.has_role(workspace_id, array['owner', 'artist']))
  with check (private.has_role(workspace_id, array['owner', 'artist']));
