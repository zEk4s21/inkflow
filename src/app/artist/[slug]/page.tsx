import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { ArtistHeader } from "@/components/public/artist-header";
import { DemoBanner } from "@/components/public/demo-banner";
import { PortfolioGrid } from "@/components/public/portfolio-grid";
import { PublicSection } from "@/components/public/section";
import { WorkImage } from "@/components/public/work-image";
import { getPublicArtist, getPublishedWorks, listPublicArtistSlugs } from "@/server/artists/public-artist";

export async function generateStaticParams() {
  const slugs = await listPublicArtistSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/artist/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getPublicArtist(slug);
  if (!artist) return {};
  const description = [artist.styles.join(" · "), artist.locationLabel].filter(Boolean).join(". ") + ".";
  return {
    title: `${artist.artistName} · Tatuajes`,
    description,
    openGraph: { title: `${artist.artistName} · Tatuajes`, description, type: "profile" },
  };
}

export default async function ArtistPage({ params }: PageProps<"/artist/[slug]">) {
  const { slug } = await params;
  const artist = await getPublicArtist(slug);
  if (!artist) notFound();
  const works = await getPublishedWorks(slug);
  const heroWorks = works.slice(0, 3);

  return (
    <>
      {artist.isDemo && <DemoBanner />}
      <ArtistHeader slug={artist.slug} artistName={artist.artistName} />

      <main id="contenido">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20">
          <div className="flex flex-col gap-8">
            {artist.locationLabel && (
              <p className="animate-rise text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">
                {artist.locationLabel}
              </p>
            )}
            <h1
              className="animate-rise font-display text-[clamp(4.5rem,18vw,11rem)] leading-[0.85] uppercase"
              style={{ animationDelay: "60ms" }}
            >
              {artist.artistName}
              <span className="sr-only"> · {artist.fullName}</span>
            </h1>
            <ul className="animate-rise flex flex-wrap gap-x-3 gap-y-1 text-lg text-fg-muted" style={{ animationDelay: "120ms" }}>
              {artist.styles.map((style, index) => (
                <li key={style} className="flex items-center gap-3 whitespace-nowrap">
                  {style}
                  {index < artist.styles.length - 1 && <span className="size-1 rounded-full bg-accent" aria-hidden />}
                </li>
              ))}
            </ul>
            <div className="animate-rise flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
              <a href="#contacto" className={buttonClasses({ size: "lg" })}>
                Iniciar mi proyecto
              </a>
              <a href="#trabajos" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                Ver trabajos
              </a>
            </div>
          </div>

          {heroWorks.length > 0 && (
            <div className="grid grid-cols-[1.4fr_1fr] gap-2 sm:gap-3" aria-hidden>
              <WorkImage
                {...heroWorks[0].image}
                alt=""
                priority
                sizes="(min-width: 1024px) 30vw, 58vw"
                className="h-full w-full rounded-md"
              />
              <div className="flex flex-col gap-2 sm:gap-3">
                {heroWorks.slice(1).map((work) => (
                  <WorkImage key={work.id} {...work.image} alt="" sizes="(min-width: 1024px) 20vw, 40vw" className="w-full rounded-md" />
                ))}
              </div>
            </div>
          )}
        </section>

        <PublicSection id="trabajos" eyebrow="Portfolio" title="Trabajos">
          {works.length > 0 ? (
            <PortfolioGrid slug={artist.slug} works={works} />
          ) : (
            <p className="text-fg-muted">Todavía no hay trabajos publicados.</p>
          )}
        </PublicSection>

        <PublicSection id="sobre-mi" eyebrow="Perfil" title={artist.fullName}>
          <div className="grid gap-10 md:grid-cols-2">
            <p className="max-w-prose text-lg leading-relaxed text-fg-muted">
              {artist.bio ?? "La biografía todavía no está cargada."}
            </p>
            <dl className="grid gap-6 text-sm">
              {artist.styles.length > 0 && (
                <div className="flex flex-col gap-1 border-b border-line pb-4">
                  <dt className="text-fg-subtle">Especialidad</dt>
                  <dd className="text-fg">{artist.styles.join(", ")}</dd>
                </div>
              )}
              {artist.locationLabel && (
                <div className="flex flex-col gap-1 border-b border-line pb-4">
                  <dt className="text-fg-subtle">Estudio</dt>
                  <dd className="text-fg">{artist.locationLabel}</dd>
                </div>
              )}
              {artist.instagram && (
                <div className="flex flex-col gap-1 border-b border-line pb-4">
                  <dt className="text-fg-subtle">Instagram</dt>
                  <dd>
                    <a href={artist.instagram.url} className="text-fg underline-offset-4 hover:underline" rel="noopener" target="_blank">
                      @{artist.instagram.handle}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </PublicSection>

        {artist.process.length > 0 && (
          <PublicSection id="proceso" eyebrow="Cómo trabajo" title="El proceso">
            <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {artist.process.map((step, index) => (
                <li key={index} className="flex flex-col gap-3 bg-ink p-6">
                  <span className="font-display text-4xl text-accent-text">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="text-lg font-medium">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-fg-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </PublicSection>
        )}

        {artist.faq.length > 0 && (
          <PublicSection id="preguntas" eyebrow="FAQ" title="Preguntas frecuentes">
            <div className="divide-y divide-line border-y border-line">
              {artist.faq.map((item, index) => (
                <details key={index} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium marker:hidden">
                    {item.question}
                    <span
                      aria-hidden
                      className="text-2xl leading-none text-fg-subtle transition-transform duration-300 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-prose leading-relaxed text-fg-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </PublicSection>
        )}

        <PublicSection id="contacto" eyebrow="Contacto" title="Contame tu idea">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1 p-6">
              <h3 className="text-lg font-medium">Por ahora, por Instagram</h3>
              <p className="text-sm leading-relaxed text-fg-muted">
                Mandá un mensaje con tu idea, la zona del cuerpo, el tamaño aproximado y referencias si tenés.
              </p>
              {artist.instagram && (
                <a href={artist.instagram.url} target="_blank" rel="noopener" className={buttonClasses({ className: "self-start" })}>
                  Escribir a @{artist.instagram.handle}
                </a>
              )}
            </div>
            <div className="flex flex-col gap-4 rounded-lg border border-dashed border-line p-6">
              <span className="self-start rounded-full bg-surface-3 px-2.5 py-1 text-xs text-fg-muted">Próximamente</span>
              <h3 className="text-lg font-medium">Formulario y asistente</h3>
              <p className="text-sm leading-relaxed text-fg-muted">
                Vas a poder contar tu idea acá mismo y un asistente te va a ayudar a armar la consulta paso a paso.
              </p>
            </div>
          </div>
        </PublicSection>
      </main>

      <footer className="border-t border-line py-10 text-center text-xs text-fg-subtle">
        {artist.artistName} · Hecho con INKFLOW
      </footer>
    </>
  );
}
