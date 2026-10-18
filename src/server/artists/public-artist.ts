import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getPublicEnv } from "@/config/env";
import { portfolioImageUrl } from "@/lib/storage";
import { createSupabasePublicClient } from "@/server/supabase/public";
import { parseFaq, parseProcess } from "./page-content";
import type { PortfolioWork, PublicArtist } from "./types";

/*
 * Punto único de lectura de datos públicos, desde Supabase con el rol anon: la RLS solo
 * deja ver perfiles publicados y trabajos publicados. Se cachea y se invalida con
 * updateTag(artistCacheTag(slug)) cuando el panel guarda cambios.
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
  };
}

export async function getPublishedWorks(slug: string): Promise<PortfolioWork[]> {
  "use cache";
  cacheTag(artistCacheTag(slug));
  cacheLife("hours");

  if (!SLUG_PATTERN.test(slug)) return [];
  const supabase = createSupabasePublicClient();
  const { data: workspace } = await supabase.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!workspace) return [];

  const { data, error } = await supabase
    .from("portfolio_items")
    .select("id, title, category, body_zone, description, image_path, image_width, image_height, alt_text")
    .eq("workspace_id", workspace.id)
    .order("position")
    .order("id");
  if (error) throw new Error(`No se pudo leer el portfolio de "${slug}": ${error.message}`);

  const supabaseUrl = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  return data.map((work) => ({
    id: work.id,
    title: work.title,
    category: work.category,
    bodyZone: work.body_zone,
    description: work.description,
    image: {
      src: portfolioImageUrl(supabaseUrl, work.image_path),
      alt: work.alt_text,
      width: work.image_width,
      height: work.image_height,
    },
  }));
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
