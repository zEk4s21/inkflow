/*
 * Links de publicaciones de Instagram. Se aceptan los que copia la app ("Copiar enlace"),
 * con o sin www, con el usuario delante o con parámetros, y se guardan siempre igual:
 * https://www.instagram.com/<p|reel>/<código>/
 */

const POST_URL = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?(?:[?#].*)?$/;

/** Link normalizado, o null si no es el link de una publicación. */
export function normalizeInstagramPostUrl(input: string): string | null {
  const match = POST_URL.exec(input.trim());
  if (!match) return null;
  const kind = match[1] === "p" || match[1] === "tv" ? "p" : "reel";
  return `https://www.instagram.com/${kind}/${match[2]}/`;
}

/** Página de embed oficial de Instagram (con el texto de la publicación). */
export function instagramEmbedUrl(postUrl: string): string {
  return `${postUrl}embed/captioned/`;
}
