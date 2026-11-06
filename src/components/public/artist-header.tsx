import Image from "next/image";
import Link from "next/link";
import type { ArtistLogo, PublicArtist } from "@/server/artists/types";
import { buttonClasses } from "@/components/ui/button";
import { HideOnScroll } from "./hide-on-scroll";

/** Secciones de la página del tatuador. Proceso y Preguntas solo existen si tienen contenido. */
export function headerSections(artist: Pick<PublicArtist, "process" | "faq">) {
  return [
    { href: "#trabajos", label: "Trabajos" },
    { href: "#sobre-mi", label: "Perfil" },
    ...(artist.process.length > 0 ? [{ href: "#proceso", label: "Proceso" }] : []),
    ...(artist.faq.length > 0 ? [{ href: "#preguntas", label: "Preguntas" }] : []),
    { href: "#contacto", label: "Contacto" },
  ];
}

export function ArtistHeader({
  slug,
  artistName,
  logo,
  sections,
}: {
  slug: string;
  artistName: string;
  logo: ArtistLogo | null;
  sections: Array<{ href: string; label: string }>;
}) {
  return (
    <HideOnScroll className="sticky top-0 z-30 border-b border-line/60 bg-ink/80 backdrop-blur-md">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link href={`/artist/${slug}`} className="flex min-h-11 items-center font-display text-2xl tracking-wide uppercase">
          {logo ? (
            <Image src={logo.src} alt={artistName} width={logo.width} height={logo.height} priority className="h-8 w-auto sm:h-9" />
          ) : (
            artistName
          )}
        </Link>
        <nav aria-label="Secciones" className="hidden md:block">
          <ul className="flex gap-8 text-sm text-fg-muted">
            {sections.map((link) => (
              <li key={link.href}>
                <a href={`/artist/${slug}${link.href}`} className="transition-colors hover:text-fg">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {/* Con la ruta completa, los enlaces también sirven desde las páginas internas (trabajo). */}
        <a href={`/artist/${slug}#contacto`} className={buttonClasses({ size: "md" })}>
          Iniciar proyecto
        </a>
      </div>
    </HideOnScroll>
  );
}
