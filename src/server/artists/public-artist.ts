import "server-only";
import { DEMO_ARTIST, DEMO_WORKS } from "./demo-data";
import type { PortfolioWork, PublicArtist } from "./types";

/*
 * Punto único de lectura de datos públicos. En la Fase 2 estas funciones consultan Supabase
 * (solo perfiles públicos y trabajos publicados); las páginas no cambian.
 */

export async function getPublicArtist(slug: string): Promise<PublicArtist | null> {
  return slug === DEMO_ARTIST.slug ? DEMO_ARTIST : null;
}

export async function getPublishedWorks(slug: string): Promise<PortfolioWork[]> {
  return slug === DEMO_ARTIST.slug ? DEMO_WORKS : [];
}

export async function getPublishedWork(slug: string, workId: string): Promise<PortfolioWork | null> {
  const works = await getPublishedWorks(slug);
  return works.find((work) => work.id === workId) ?? null;
}

export async function listPublicArtistSlugs(): Promise<string[]> {
  return [DEMO_ARTIST.slug];
}
