import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ArtistHeader } from "@/components/public/artist-header";
import { PortfolioGrid } from "@/components/public/portfolio-grid";
import { RequestForm } from "@/components/public/request-form";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { PublicSection } from "@/components/public/section";
import { WorkImage } from "@/components/public/work-image";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicArtist, getPublishedWorks, listPublicArtistSlugs } from "@/server/artists/public-artist";
import { getPublicAvailability, toSlotDays } from "@/server/availability/public";
import { getAiConfig } from "@/server/integrations/ai";
import { getCaptchaConfig } from "@/server/requests/captcha";

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
    twitter: { card: "summary_large_image" },
  };
}

export default async function ArtistPage({ params }: PageProps<"/artist/[slug]">) {
  const { slug } = await params;
  const artist = await getPublicArtist(slug);
  if (!artist) notFound();
  const works = await getPublishedWorks(slug);
  const captcha = getCaptchaConfig();
  // El asistente necesita IA y captcha; si falta algo no se ofrece (su página igual lo explica).
  const assistantAvailable = getAiConfig().status === "configured" && captcha.mode !== "missing";
  const heroWorks = works.slice(0, 3);

  return (
    <div className="grain">
      <ScrollReveal />
      <ArtistHeader slug={artist.slug} artistName={artist.artistName} />

      <main id="contenido">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-10 pb-16 sm:px-8 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-16">
          <div className="flex flex-col gap-8">
            {artist.locationLabel && (
              <p className="flex animate-rise items-center gap-3 text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">
                <span className="hidden h-px w-8 shrink-0 bg-accent sm:block" aria-hidden />
                {artist.locationLabel}
              </p>
            )}
            <h1 className="font-display text-[clamp(5rem,30vw,12rem)] leading-[0.85] uppercase">
              <span className="sr-only">
                {artist.artistName} · {artist.fullName}
              </span>
              {/* Cada letra sube desde atrás de su propia máscara. */}
              <span aria-hidden className="flex">
                {Array.from(artist.artistName).map((letter, index) => (
                  <span key={index} className="inline-block overflow-hidden pb-[0.04em]">
                    <span className="inline-block animate-letter whitespace-pre" style={{ animationDelay: `${150 + index * 70}ms` }}>
                      {letter}
                    </span>
                  </span>
                ))}
              </span>
            </h1>
            <ul className="animate-rise flex flex-wrap gap-x-3 gap-y-1 text-lg text-fg-muted" style={{ animationDelay: "450ms" }}>
              {artist.styles.map((style, index) => (
                <li key={style} className="flex items-center gap-3 whitespace-nowrap">
                  {style}
                  {index < artist.styles.length - 1 && <span className="size-1 rounded-full bg-accent" aria-hidden />}
                </li>
              ))}
            </ul>
            <div className="animate-rise flex flex-wrap gap-3" style={{ animationDelay: "550ms" }}>
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
              <HeroFrame delay={250} className="h-full">
                <WorkImage {...heroWorks[0].image} alt="" priority sizes="(min-width: 1024px) 30vw, 58vw" className="h-full w-full" />
              </HeroFrame>
              <div className="flex flex-col gap-2 sm:gap-3">
                {heroWorks.slice(1).map((work, index) => (
                  <HeroFrame key={work.id} delay={450 + index * 150}>
                    <WorkImage {...work.image} alt="" sizes="(min-width: 1024px) 20vw, 40vw" className="w-full" />
                  </HeroFrame>
                ))}
              </div>
            </div>
          )}
        </section>

        {artist.styles.length > 0 && <StylesMarquee styles={artist.styles} />}

        <PublicSection id="trabajos" eyebrow="Portfolio" title="Trabajos">
          {works.length > 0 ? (
            <PortfolioGrid slug={artist.slug} works={works} />
          ) : (
            <p className="text-fg-muted">Todavía no hay trabajos publicados.</p>
          )}
        </PublicSection>

        <PublicSection id="sobre-mi" eyebrow="Perfil" title={artist.fullName}>
          <div className="grid gap-10 md:grid-cols-2">
            <p data-reveal className="max-w-prose text-lg leading-relaxed text-fg-muted">
              {artist.bio ?? "La biografía todavía no está cargada."}
            </p>
            <dl data-reveal className="grid gap-6 text-sm" style={{ "--reveal-delay": "120ms" } as CSSProperties}>
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
                <li
                  key={index}
                  data-reveal
                  className="group flex flex-col gap-3 bg-ink p-6 transition-colors duration-500 hover:bg-surface-1"
                  style={{ "--reveal-delay": `${(index % 3) * 90}ms` } as CSSProperties}
                >
                  <span className="font-display text-4xl text-accent-text transition-transform duration-500 ease-(--ease-out-soft) group-hover:-translate-y-1">{String(index + 1).padStart(2, "0")}</span>
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
                <details key={index} data-reveal className="group py-5">
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
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            {captcha.mode === "missing" ? (
              <p className="text-fg-muted">El formulario no está disponible por ahora. Escribime por Instagram.</p>
            ) : (
              <Suspense fallback={<RequestFormSkeleton />}>
                <RequestFormWithSlots slug={artist.slug} turnstileSiteKey={captcha.mode === "turnstile" ? captcha.siteKey : null} />
              </Suspense>
            )}
            <div className="flex flex-col gap-6 self-start">
              {assistantAvailable && (
                <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1 p-6">
                  <h3 className="text-lg font-medium">¿No sabés cómo contarla?</h3>
                  <p className="text-sm leading-relaxed text-fg-muted">
                    El asistente te hace unas preguntas y arma el resumen de tu idea: zona, tamaño, estilo y detalles.
                  </p>
                  <Link href={`/artist/${artist.slug}/assistant`} className={buttonClasses({ variant: "secondary", className: "self-start" })}>
                    Armar mi idea con el asistente
                  </Link>
                </div>
              )}
              <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1 p-6">
                <h3 className="text-lg font-medium">¿Tenés referencias?</h3>
                <p className="text-sm leading-relaxed text-fg-muted">
                  Mandá la consulta y después pasame las imágenes por Instagram. Cargar fotos desde acá llega más adelante.
                </p>
                {artist.instagram && (
                  <a
                    href={artist.instagram.url}
                    target="_blank"
                    rel="noopener"
                    className={buttonClasses({ variant: "secondary", className: "self-start" })}
                  >
                    Escribir a @{artist.instagram.handle}
                  </a>
                )}
              </div>
            </div>
          </div>
        </PublicSection>
      </main>

      <footer className="border-t border-line py-10 text-center text-xs text-fg-subtle">
        {artist.artistName} · Hecho con INKFLOW
      </footer>
    </div>
  );
}

/** Marco de foto del hero: se descubre de abajo hacia arriba mientras la foto se asienta. */
function HeroFrame({ delay, className, children }: { delay: number; className?: string; children: ReactNode }) {
  return (
    <div className={`animate-unveil overflow-hidden rounded-md ${className ?? ""}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="h-full animate-settle" style={{ animationDelay: `${delay}ms` }}>
        {children}
      </div>
    </div>
  );
}

/** Franja con los estilos en movimiento continuo. Decorativa: los estilos ya están en el hero. */
function StylesMarquee({ styles }: { styles: string[] }) {
  // Se repite hasta llenar el ancho; la segunda mitad es copia para que el loop no salte.
  const items = Array.from({ length: Math.max(2, Math.ceil(6 / styles.length)) }, () => styles).flat();
  return (
    <div aria-hidden className="overflow-hidden border-t border-line py-6 sm:py-8">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center">
            {items.map((style, index) => (
              <span key={index} className="flex items-center font-display text-5xl whitespace-nowrap uppercase sm:text-7xl">
                <span className={index % 2 === 1 ? "text-outline" : "text-fg"}>{style}</span>
                <span className="mx-6 text-3xl text-accent sm:mx-10 sm:text-5xl">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Los turnos libres cambian con cada pedido confirmado: se calculan en cada visita, fuera de la caché. */
async function RequestFormWithSlots({ slug, turnstileSiteKey }: { slug: string; turnstileSiteKey: string | null }) {
  await connection();
  const availability = await getPublicAvailability(slug).catch((error: unknown) => {
    // Sin turnos el formulario sigue sirviendo como consulta.
    console.error("[artist] turnos", error instanceof Error ? error.message : error);
    return null;
  });
  const slotDays = availability ? toSlotDays(availability.slots, availability.regional) : [];
  return <RequestForm slug={slug} turnstileSiteKey={turnstileSiteKey} slotDays={slotDays} />;
}

function RequestFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <Skeleton className="h-36" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12 w-40" />
    </div>
  );
}
