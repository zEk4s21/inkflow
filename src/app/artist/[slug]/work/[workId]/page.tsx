import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { ArtistHeader } from "@/components/public/artist-header";
import { DemoBanner } from "@/components/public/demo-banner";
import { WorkImage } from "@/components/public/work-image";
import {
  getPublicArtist,
  getPublishedWork,
  getPublishedWorks,
  listPublicArtistSlugs,
} from "@/server/artists/public-artist";

export async function generateStaticParams() {
  const params: Array<{ slug: string; workId: string }> = [];
  for (const slug of await listPublicArtistSlugs()) {
    for (const work of await getPublishedWorks(slug)) params.push({ slug, workId: work.id });
  }
  return params;
}

export async function generateMetadata({ params }: PageProps<"/artist/[slug]/work/[workId]">): Promise<Metadata> {
  const { slug, workId } = await params;
  const [artist, work] = await Promise.all([getPublicArtist(slug), getPublishedWork(slug, workId)]);
  if (!artist || !work) return {};
  return {
    title: `${work.title} · ${artist.artistName}`,
    description: work.image.alt,
    openGraph: { images: [{ url: work.image.src, width: work.image.width, height: work.image.height }] },
  };
}

export default async function WorkPage({ params }: PageProps<"/artist/[slug]/work/[workId]">) {
  const { slug, workId } = await params;
  const [artist, work, works] = await Promise.all([
    getPublicArtist(slug),
    getPublishedWork(slug, workId),
    getPublishedWorks(slug),
  ]);
  if (!artist || !work) notFound();

  const index = works.findIndex((item) => item.id === work.id);
  const previous = works[index - 1];
  const next = works[index + 1];

  return (
    <>
      {artist.isDemo && <DemoBanner />}
      <ArtistHeader slug={artist.slug} artistName={artist.artistName} />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:py-16">
        <WorkImage {...work.image} priority sizes="(min-width: 1024px) 55vw, 100vw" className="w-full rounded-lg" />

        <div className="flex flex-col gap-8 lg:pt-6">
          <Link href={`/artist/${artist.slug}#trabajos`} className="text-sm text-fg-muted hover:text-fg">
            ← Volver a trabajos
          </Link>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">{work.category}</p>
            <h1 className="font-display text-5xl uppercase sm:text-6xl">{work.title}</h1>
            {work.description && <p className="leading-relaxed text-fg-muted">{work.description}</p>}
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col gap-1 border-t border-line pt-3">
              <dt className="text-fg-subtle">Estilo</dt>
              <dd>{work.category}</dd>
            </div>
            {work.bodyZone && (
              <div className="flex flex-col gap-1 border-t border-line pt-3">
                <dt className="text-fg-subtle">Zona</dt>
                <dd>{work.bodyZone}</dd>
              </div>
            )}
          </dl>

          <a href={`/artist/${artist.slug}#contacto`} className={buttonClasses({ size: "lg", className: "self-start" })}>
            Quiero algo así
          </a>

          <nav aria-label="Otros trabajos" className="mt-auto flex justify-between gap-4 border-t border-line pt-6 text-sm">
            {previous ? (
              <Link href={`/artist/${artist.slug}/work/${previous.id}`} className="text-fg-muted hover:text-fg">
                ← {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/artist/${artist.slug}/work/${next.id}`} className="text-right text-fg-muted hover:text-fg">
                {next.title} →
              </Link>
            )}
          </nav>
        </div>
      </main>
    </>
  );
}
