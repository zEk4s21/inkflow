import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

const links = [
  { href: "#trabajos", label: "Trabajos" },
  { href: "#proceso", label: "Proceso" },
  { href: "#preguntas", label: "Preguntas" },
  { href: "#contacto", label: "Contacto" },
];

export function ArtistHeader({ slug, artistName }: { slug: string; artistName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link href={`/artist/${slug}`} className="font-display text-2xl tracking-wide uppercase">
          {artistName}
        </Link>
        <nav aria-label="Secciones" className="hidden md:block">
          <ul className="flex gap-8 text-sm text-fg-muted">
            {links.map((link) => (
              <li key={link.href}>
                <a href={`/artist/${slug}${link.href}`} className="transition-colors hover:text-fg">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {/* Con la ruta completa, los enlaces también sirven desde las páginas internas (trabajo, asistente). */}
        <a href={`/artist/${slug}#contacto`} className={buttonClasses({ size: "sm" })}>
          Iniciar proyecto
        </a>
      </div>
    </header>
  );
}
