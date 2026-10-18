-- Fase 4.2: conversaciones del Ink Assistant.
--
-- Un visitante conversa con el asistente para armar el resumen (brief) de su idea. El navegador
-- guarda un token al azar en una cookie httpOnly; acá solo se guarda su hash, así que quien lea la
-- base no puede retomar la conversación de otro. Todo entra por Server Actions con la clave secreta,
-- después de captcha y límite de envíos: anon no tiene privilegios. Los miembros leen.
--
-- El chat no pide datos de contacto (nombre, email, teléfono): esos se cargan en un formulario al
-- confirmar (Fase 4.3) y nunca pasan por el modelo.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_hash text not null unique
    constraint conversations_token_hash check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Resumen estructurado que arma el asistente; lo valida zod en el servidor antes de guardarlo.
  brief jsonb not null default '{}'::jsonb
    constraint conversations_brief_object check (jsonb_typeof(brief) = 'object'),
  status text not null default 'open'
    constraint conversations_status check (status in ('open', 'confirmed', 'closed')),
  message_count integer not null default 0 constraint conversations_message_count check (message_count >= 0),
  input_tokens integer not null default 0 constraint conversations_input_tokens check (input_tokens >= 0),
  output_tokens integer not null default 0 constraint conversations_output_tokens check (output_tokens >= 0),
  submitter_hash text,
  -- Retención limitada: después de esta fecha no se puede seguir y se puede borrar.
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_workspace_created_idx on public.conversations (workspace_id, created_at desc);
create index conversations_submitter_idx on public.conversations (submitter_hash, created_at desc);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null constraint conversation_messages_role check (role in ('user', 'assistant')),
  content text not null constraint conversation_messages_content check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index conversation_messages_conversation_idx on public.conversation_messages (conversation_id, created_at);

create trigger conversations_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();

revoke all on public.conversations, public.conversation_messages from anon, authenticated;
grant select (id, workspace_id, brief, status, message_count, input_tokens, output_tokens, expires_at, created_at, updated_at)
  on public.conversations to authenticated;
grant select on public.conversation_messages to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "Miembros leen las conversaciones" on public.conversations
  for select to authenticated using (private.is_member(workspace_id));

create policy "Miembros leen los mensajes" on public.conversation_messages
  for select to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id and private.is_member(c.workspace_id))
  );

-- Guarda un turno de una vez: el mensaje de la persona, la respuesta, el resumen y los tokens.
-- El tope de mensajes se vuelve a comprobar acá, así dos envíos simultáneos no lo pasan.
-- Sin respuesta (la IA falló o el tope ya se alcanzó) solo suma los tokens gastados.
-- Devuelve true si guardó los mensajes. Solo la usa el servidor con la clave secreta.
create function public.record_conversation_turn(
  p_conversation uuid,
  p_max_messages integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_brief jsonb default null,
  p_user_message text default null,
  p_assistant_message text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  sent_at timestamptz := clock_timestamp();
begin
  if p_assistant_message is not null and p_user_message is not null and p_brief is not null then
    update public.conversations
       set message_count = message_count + 1,
           brief = p_brief,
           input_tokens = input_tokens + p_input_tokens,
           output_tokens = output_tokens + p_output_tokens
     where id = p_conversation and status = 'open' and expires_at > now() and message_count < p_max_messages;
    if found then
      insert into public.conversation_messages (conversation_id, role, content, created_at) values
        (p_conversation, 'user', p_user_message, sent_at),
        (p_conversation, 'assistant', p_assistant_message, sent_at + interval '1 millisecond');
      return true;
    end if;
  end if;
  update public.conversations
     set input_tokens = input_tokens + p_input_tokens, output_tokens = output_tokens + p_output_tokens
   where id = p_conversation;
  return false;
end;
$$;

-- Tokens gastados por un estudio en las conversaciones empezadas desde p_since (tope mensual).
create function public.workspace_ai_tokens_since(p_workspace uuid, p_since timestamptz)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(input_tokens::bigint + output_tokens), 0)
    from public.conversations
   where workspace_id = p_workspace and created_at >= p_since;
$$;

revoke all on function public.record_conversation_turn(uuid, integer, integer, integer, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.workspace_ai_tokens_since(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.record_conversation_turn(uuid, integer, integer, integer, jsonb, text, text) to service_role;
grant execute on function public.workspace_ai_tokens_since(uuid, timestamptz) to service_role;
