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
  /** Solo en los trabajos que vienen de Instagram: datos de la publicación original. */
  instagram?: InstagramPostInfo;
};

export type ArtistLogo = { src: string; width: number; height: number };

export type InstagramPostInfo = {
  permalink: string;
  caption: string | null;
  /** ISO 8601. */
  postedAt: string;
  /** null cuando Instagram no lo informa (por ejemplo, si el autor ocultó los likes). */
  likeCount: number | null;
  commentsCount: number | null;
  /** Video del reel, si es un video. */
  videoUrl: string | null;
};
