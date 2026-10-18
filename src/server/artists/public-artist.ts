import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/server/supabase/public";
import { DEMO_WORKS, DEMO_WORKS_SLUG } from "./demo-data";
import { parseFaq, parseProcess } from "./page-content";
import type { PortfolioWork, PublicArtist } from "./types";

/*
 * Punto único de lectura de datos públicos. Perfil y textos salen de Supabase (rol anon,
 * solo perfiles publicados). Los trabajos siguen siendo demo hasta la Fase 2.4.
 */

export function artistCacheTag(slug: string) {
  return `artist:${slug}`;
}

// Mismo formato que el CHECK de workspaces.slug: lo que no cumple ni se consulta.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Con Cache Components, generateStaticParams no puede devolver una lista vacía.
 * Si no hay slugs (base vacía o caída en el build) se usa este, que no es un slug
 * válido y por eso responde 404 sin consultar la base.
 */
export const PLACEHOLDER_SLUG = "_";

export async function getPublicArtist(slug: string): Promise<PublicArtist | null> {
  "use cache";
  cacheTag(artistCacheTag(slug));
  cacheLife("hours");

  if (!SLUG_PATTERN.test(slug)) return null;

  const supabase = createSupabasePublicClient();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el workspace "${slug}": ${error.message}`);
  if (!workspace) return null;

  const [profileResult, settingsResult] = await Promise.all([
    supabase
      .from("artist_profiles")
      .select("display_name, full_name, bio, styles")
      .eq("workspace_id", workspace.id)
      .order("display_name")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workspace_settings")
      .select("location_label, instagram_handle, process, faq")
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
  ]);
  const profile = profileResult.data;
  if (!profile) return null;
  const settings = settingsResult.data;

  return {
    slug: workspace.slug,
    artistName: profile.display_name,
    fullName: profile.full_name ?? profile.display_name,
    styles: profile.styles,
    locationLabel: settings?.location_label ?? null,
    bio: profile.bio,
    instagram: settings?.instagram_handle
      ? { handle: settings.instagram_handle, url: `https://www.instagram.com/${settings.instagram_handle}/` }
      : null,
    process: parseProcess(settings?.process),
    faq: parseFaq(settings?.faq),
    isDemo: slug === DEMO_WORKS_SLUG,
  };
}

export async function getPublishedWorks(slug: string): Promise<PortfolioWork[]> {
  return slug === DEMO_WORKS_SLUG ? DEMO_WORKS : [];
}

export async function getPublishedWork(slug: string, workId: string): Promise<PortfolioWork | null> {
  const works = await getPublishedWorks(slug);
  return works.find((work) => work.id === workId) ?? null;
}

/**
 * Slugs a prerenderizar en el build. Los que falten (o todos, si la base no responde)
 * se renderizan a pedido. Nunca devuelve una lista vacía (ver PLACEHOLDER_SLUG).
 */
export async function listPublicArtistSlugs(): Promise<string[]> {
  try {
    const { data, error } = await createSupabasePublicClient().from("workspaces").select("slug");
    if (error) throw error;
    if (data.length > 0) return data.map((row) => row.slug);
  } catch (error) {
    console.warn("[artists] No se pudieron listar los slugs públicos:", error instanceof Error ? error.message : error);
  }
  return [PLACEHOLDER_SLUG];
}
