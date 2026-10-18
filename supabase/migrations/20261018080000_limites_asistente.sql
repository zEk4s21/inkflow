-- Fase 4.4: consumo del Ink Assistant visible en el panel y retención limitada de conversaciones.

-- Consumo de un estudio desde una fecha: conversaciones empezadas, consultas que salieron del
-- asistente y tokens. Corre con los permisos de quien llama (RLS): un miembro solo ve lo suyo.
create function public.workspace_ai_usage(p_workspace uuid, p_since timestamptz)
returns table (conversations bigint, requests bigint, tokens bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.conversations c where c.workspace_id = p_workspace and c.created_at >= p_since),
    (select count(*) from public.tattoo_requests r
      where r.workspace_id = p_workspace and r.source = 'assistant' and r.created_at >= p_since and r.deleted_at is null),
    (select coalesce(sum(c.input_tokens::bigint + c.output_tokens), 0)
       from public.conversations c where c.workspace_id = p_workspace and c.created_at >= p_since);
$$;

revoke all on function public.workspace_ai_usage(uuid, timestamptz) from public, anon;
grant execute on function public.workspace_ai_usage(uuid, timestamptz) to authenticated, service_role;

-- Retención: lo que se charló en una conversación que no terminó en consulta se borra al vencer
-- (7 días). La fila queda, vacía y cerrada, solo para el conteo de tokens del mes, y se borra
-- a los 62 días. Las confirmadas se quedan: son parte de la consulta que ve el tatuador.
-- Corre todos los días con pg_cron; solo la clave secreta puede llamarla a mano (tests).
create function public.purge_expired_conversations()
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.conversation_messages m
   using public.conversations c
   where m.conversation_id = c.id and c.status <> 'confirmed' and c.expires_at < now();
  update public.conversations
     set brief = '{}'::jsonb, status = 'closed'
   where status <> 'confirmed' and expires_at < now() and (status <> 'closed' or brief <> '{}'::jsonb);
  delete from public.conversations where status <> 'confirmed' and created_at < now() - interval '62 days';
end;
$$;

revoke all on function public.purge_expired_conversations() from public, anon, authenticated;
grant execute on function public.purge_expired_conversations() to service_role;

create extension if not exists pg_cron;
select cron.schedule('inkflow-purge-conversations', '17 4 * * *', 'select public.purge_expired_conversations()');
