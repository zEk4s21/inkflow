/** Forma pública de un tatuador. Solo contiene datos aptos para mostrarse sin login. */
export type PublicArtist = {
  slug: string;
  artistName: string;
  fullName: string;
  styles: string[];
  locationLabel: string;
  /** null cuando el tatuador todavía no cargó su biografía. */
  bio: string | null;
  instagram: { handle: string; url: string } | null;
  process: Array<{ title: string; description: string }>;
  faq: Array<{ question: string; answer: string }>;
  /** true mientras el contenido sea de ejemplo y no venga de la base de datos. */
  isDemo: boolean;
};

export type PortfolioWork = {
  id: string;
  title: string;
  category: string;
  bodyZone: string | null;
  description: string | null;
  image: { src: string; alt: string; width: number; height: number };
};
