-- Cada trabajo del portfolio puede llevar el link de su publicación de Instagram. La página
-- pública la muestra con el embed oficial de Instagram, que no necesita token.
--
-- Reemplaza la conexión por token (20261105010000_instagram.sql): Meta ya no ofrece
-- "API setup with Instagram login" en las apps nuevas, así que esa tabla nunca se usó.

drop table public.instagram_connections;

-- Se guarda normalizado (lo hace el servidor): https://www.instagram.com/<p|reel>/<código>/
alter table public.portfolio_items
  add column instagram_url text
    constraint portfolio_items_instagram_url_format
    check (instagram_url ~ '^https://www\.instagram\.com/(p|reel)/[A-Za-z0-9_-]{5,40}/$');

grant select (instagram_url) on public.portfolio_items to anon;
grant insert (instagram_url) on public.portfolio_items to authenticated;
grant update (instagram_url) on public.portfolio_items to authenticated;
