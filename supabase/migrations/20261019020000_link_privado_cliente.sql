-- Fase 5.2: link privado para que el cliente vea el estado de su consulta.
--
-- El link lleva un token al azar de 256 bits; acá se guarda solo su sha256. Lo genera owner o
-- artista desde el panel (se muestra una sola vez) y generar otro o desactivarlo invalida el
-- anterior. La página pública lo busca con la clave secreta y muestra solo lo que es del cliente:
-- nunca notas internas, historial ni la conversación con el asistente.

alter table public.tattoo_requests
  add column public_token_hash text
    constraint tattoo_requests_public_token_hash check (public_token_hash ~ '^[0-9a-f]{64}$'),
  add column public_token_created_at timestamptz,
  add constraint tattoo_requests_public_token_pair
    check ((public_token_hash is null) = (public_token_created_at is null));

create unique index tattoo_requests_public_token_idx on public.tattoo_requests (public_token_hash)
  where public_token_hash is not null;

-- La política de update existente ya limita a owner o artista.
grant update (public_token_hash, public_token_created_at) on public.tattoo_requests to authenticated;
