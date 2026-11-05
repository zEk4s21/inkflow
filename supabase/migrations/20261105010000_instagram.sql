-- Portfolio desde Instagram: token de la cuenta profesional de cada tatuador.
--
-- El token da acceso de lectura a las publicaciones de esa cuenta. Vence a los 60 días y el
-- servidor lo renueva antes de que pase (la renovación devuelve uno nuevo que reemplaza al
-- anterior). Solo lo lee y escribe el servidor con la clave secreta: ni anon ni los miembros
-- lo ven, por eso la tabla tiene RLS activada y ninguna política.

create table public.instagram_connections (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  access_token text not null constraint instagram_connections_token_length check (char_length(access_token) between 20 and 1000),
  expires_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

revoke all on public.instagram_connections from anon, authenticated;

alter table public.instagram_connections enable row level security;
