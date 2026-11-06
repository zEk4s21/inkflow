/** Forma pública de un tatuador. Solo contiene datos aptos para mostrarse sin login. */
export type PublicArtist = {
  slug: string;
  artistName: string;
  fullName: string;
  styles: string[];
  locationLabel: string | null;
  /** null cuando el tatuador todavía no cargó su biografía. */
  bio: string | null;
  instagram: { handle: string; url: string } | null;
  /** WhatsApp del estudio; `label` es para mostrar ("+54 9 11 3129-1602"). */
  whatsapp: { phone: string; label: string; url: string } | null;
  /** Logo en blanco (fondo transparente). null: se muestra el nombre artístico. */
  logo: ArtistLogo | null;
  process: Array<{ title: string; description: string }>;
  faq: Array<{ question: string; answer: string }>;
};

export type PortfolioWork = {
  id: string;
  title: string;
  category: string;
  bodyZone: string | null;
  description: string | null;
  image: { src: string; alt: string; width: number; height: number };
  /** Link normalizado a la publicación de Instagram (ver src/lib/instagram.ts), si lo cargaron. */
  instagramUrl: string | null;
};

export type ArtistLogo = { src: string; width: number; height: number };
