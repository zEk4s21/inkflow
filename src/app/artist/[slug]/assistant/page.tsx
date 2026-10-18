import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistHeader } from "@/components/public/artist-header";
import { buttonClasses } from "@/components/ui/button";
import { getPublicArtist, listPublicArtistSlugs } from "@/server/artists/public-artist";

export async function generateStaticParams() {
  const slugs = await listPublicArtistSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/artist/[slug]/assistant">): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getPublicArtist(slug);
  if (!artist) return {};
  // Mientras el asistente no funcione, la página no se indexa.
  return { title: `Ink Assistant · ${artist.artistName}`, robots: { index: false } };
}

/**
 * Ink Assistant. En la Fase 4.1 solo existe el estado "no disponible": la conversación llega en la 4.2.
 * No se le dice al público por qué (si falta la clave o todavía no está habilitado): eso lo ve el panel.
 */
export default async function AssistantPage({ params }: PageProps<"/artist/[slug]/assistant">) {
  const { slug } = await params;
  const artist = await getPublicArtist(slug);
  if (!artist) notFound();

  return (
    <>
      <ArtistHeader slug={artist.slug} artistName={artist.artistName} />
      <main id="contenido" className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-8 lg:py-24">
        <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">Ink Assistant</p>
        <h1 className="font-display text-5xl uppercase sm:text-6xl">Armá tu idea</h1>
        <div role="status" className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1 p-6">
          <h2 className="text-lg font-medium">El asistente no está disponible por ahora</h2>
          <p className="leading-relaxed text-fg-muted">
            Mientras tanto, contame tu idea con el formulario: zona, tamaño, estilo y lo que tengas en mente. Te respondo por el medio de contacto
            que dejes.
          </p>
          <Link href={`/artist/${artist.slug}#contacto`} className={buttonClasses({ size: "lg", className: "self-start" })}>
            Ir al formulario
          </Link>
        </div>
      </main>
    </>
  );
}
