import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { mediaToWorks, type InstagramMedia } from "@/lib/instagram";
import { artistCacheTag } from "@/server/artists/public-artist";
import type { PortfolioWork } from "@/server/artists/types";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

/*
 * Portfolio desde Instagram (API de Instagram con inicio de sesión de Instagram). El token de
 * cada estudio está en instagram_connections y se carga con `pnpm instagram:connect`.
 * Se cachea una hora: así las publicaciones nuevas aparecen solas y los links de las fotos
 * (que Instagram hace vencer) siempre están vigentes.
 */

const GRAPH = "https://graph.instagram.com";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
const POSTS_LIMIT = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Se renueva cuando faltan menos de estos días para que venza (vence a los 60). */
const REFRESH_WHEN_DAYS_LEFT = 20;

/**
 * Últimas publicaciones del tatuador, o null si no tiene Instagram conectado o la API falla:
 * en ese caso la página usa los trabajos cargados en el panel.
 */
export async function getInstagramWorks(slug: string): Promise<PortfolioWork[] | null> {
  "use cache";
  cacheTag(artistCacheTag(slug));
  cacheLife("hours");

  try {
    const admin = createSupabaseAdminClient();
    const { data: workspace } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
    if (!workspace) return null;
    const { data: connection, error } = await admin
      .from("instagram_connections")
      .select("access_token, expires_at, refreshed_at")
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!connection) return null;

    const token = await refreshIfNeeded(workspace.id, connection);
    const url = `${GRAPH}/me/media?fields=${FIELDS}&limit=${POSTS_LIMIT}&access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Instagram respondió ${response.status}`);
    const body = (await response.json()) as { data?: InstagramMedia[] };
    const works = mediaToWorks(body.data ?? []);
    return works.length > 0 ? works : null;
  } catch (error) {
    // Nunca se loguea el token: solo el motivo.
    console.warn(`[instagram] No se pudo leer el feed de "${slug}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function refreshIfNeeded(
  workspaceId: string,
  connection: { access_token: string; expires_at: string; refreshed_at: string },
): Promise<string> {
  const now = Date.now();
  const expiresAt = new Date(connection.expires_at).getTime();
  const refreshedAt = new Date(connection.refreshed_at).getTime();
  // Instagram solo deja renovar tokens de más de 24 horas que todavía no vencieron.
  if (expiresAt - now > REFRESH_WHEN_DAYS_LEFT * DAY_MS || now - refreshedAt < DAY_MS || expiresAt <= now) {
    return connection.access_token;
  }
  const response = await fetch(
    `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(connection.access_token)}`,
  );
  if (!response.ok) {
    console.warn(`[instagram] No se pudo renovar el token (${response.status}); se sigue usando el actual.`);
    return connection.access_token;
  }
  const body = (await response.json()) as { access_token: string; expires_in: number };
  const { error } = await createSupabaseAdminClient()
    .from("instagram_connections")
    .update({
      access_token: body.access_token,
      expires_at: new Date(now + body.expires_in * 1000).toISOString(),
      refreshed_at: new Date(now).toISOString(),
    })
    .eq("workspace_id", workspaceId);
  if (error) console.warn("[instagram] No se pudo guardar el token renovado:", error.message);
  return body.access_token;
}
