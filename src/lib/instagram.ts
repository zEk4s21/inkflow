import type { PortfolioWork } from "@/server/artists/types";

/** Una publicación tal como la devuelve la API de Instagram (GET /me/media). */
export type InstagramMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

export const INSTAGRAM_CATEGORY = "Instagram";
const TITLE_MAX = 60;
// Instagram no informa el tamaño: la grilla recorta a 4:5 (el formato vertical del feed).
const NOMINAL_SIZE = { width: 1080, height: 1350 };

/** Título corto a partir del texto: la primera línea, sin hashtags ni menciones al final. */
export function titleFromCaption(caption: string | null | undefined): string {
  const firstLine = (caption ?? "").split("\n").find((line) => line.trim() !== "") ?? "";
  const clean = firstLine
    .replace(/(^|\s)[#@][\p{L}\p{N}_.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "Publicación de Instagram";
  if (clean.length <= TITLE_MAX) return clean;
  return `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Pasa las publicaciones a trabajos del portfolio. Las que no traen imagen se saltean. */
export function mediaToWorks(media: InstagramMedia[]): PortfolioWork[] {
  const works: PortfolioWork[] = [];
  for (const item of media) {
    const isVideo = item.media_type === "VIDEO";
    const imageUrl = isVideo ? item.thumbnail_url : item.media_url;
    if (!imageUrl) continue;
    const title = titleFromCaption(item.caption);
    works.push({
      id: `ig-${item.id}`,
      title,
      category: INSTAGRAM_CATEGORY,
      bodyZone: null,
      description: item.caption?.trim() || null,
      image: { src: imageUrl, alt: title, ...NOMINAL_SIZE },
      instagram: {
        permalink: item.permalink,
        caption: item.caption?.trim() || null,
        postedAt: item.timestamp,
        likeCount: item.like_count ?? null,
        commentsCount: item.comments_count ?? null,
        videoUrl: isVideo ? (item.media_url ?? null) : null,
      },
    });
  }
  return works;
}
