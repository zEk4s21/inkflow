import type { ArtistLogo } from "@/server/artists/types";

/**
 * Logos de los tatuadores, por slug. Van en blanco con fondo transparente, en
 * public/artists/<slug>/. Más adelante se podrán subir desde el panel; mientras tanto se
 * agregan acá. Sin logo, la página pública muestra el nombre artístico.
 */
const LOGOS: Record<string, ArtistLogo> = {
  esti: { src: "/artists/esti/logo.png", width: 1200, height: 410 },
};

export function artistLogo(slug: string): ArtistLogo | null {
  return LOGOS[slug] ?? null;
}
