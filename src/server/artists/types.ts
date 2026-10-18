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
};
