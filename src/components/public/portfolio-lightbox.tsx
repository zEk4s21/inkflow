"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { InstagramPostInfo, PortfolioWork } from "@/server/artists/types";
import { InstagramIcon } from "./instagram-icon";
import { InstagramStats } from "./instagram-stats";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, ExternalIcon } from "@/components/ui/icons";

/** Quién firma las publicaciones de Instagram en el visor. */
export type PostAuthor = { name: string; logoSrc: string | null; location: string | null };

/** Distancia mínima (px) de un deslizamiento horizontal para pasar de foto. */
const SWIPE_THRESHOLD = 50;

/**
 * Visor a pantalla completa del portfolio: flechas, teclado (← → Esc) y deslizar en el celular.
 * Lo abre y cierra PortfolioGrid (con transición de la foto si el navegador la soporta).
 */
export function PortfolioLightbox({
  slug,
  works,
  author,
  index,
  dialogRef,
  onNavigate,
  onClose,
  onLeave,
}: {
  slug: string;
  works: PortfolioWork[];
  author: PostAuthor;
  index: number | null;
  dialogRef: RefObject<HTMLDialogElement | null>;
  onNavigate: (index: number) => void;
  onClose: () => void;
  /** Cierra sin animación, al ir a la ficha del trabajo. */
  onLeave: () => void;
}) {
  const work = index === null ? null : works[index];
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const hasMany = works.length > 1;

  const go = (step: number) => {
    if (index === null || !hasMany) return;
    onNavigate((index + step + works.length) % works.length);
  };

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    // Mientras el visor está abierto la página de atrás no se desplaza.
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = overflow;
    };
  });

  // Al ir a otra página Next conserva esta oculta (para volver atrás): un diálogo modal que
  // quede abierto ahí bloquearía los clics de la página nueva.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => dialog?.close();
  }, [dialogRef]);

  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  // Las vecinas se precargan para que al pasar no haya espera.
  const neighbors = index === null || !hasMany ? [] : [works[(index + 1) % works.length], works[(index - 1 + works.length) % works.length]];

  return (
    <dialog
      ref={dialogRef}
      aria-label={work ? `${work.title}, ${index! + 1} de ${works.length}` : "Visor del portfolio"}
      className="lightbox m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-fg"
      onClose={onClose}
      onCancel={(event) => {
        // Esc: se cierra desde PortfolioGrid para animar la vuelta.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {work?.instagram && (
        <InstagramPost
          work={work}
          post={work.instagram}
          author={author}
          hasMany={hasMany}
          onPrevious={() => go(-1)}
          onNext={() => go(1)}
          onClose={onClose}
          swipeHandlers={{ onPointerDown, onPointerUp, onPointerCancel: () => (swipeStart.current = null) }}
        />
      )}
      {work && !work.instagram && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8 sm:py-5">
            <p className="text-sm tabular-nums text-fg-muted" aria-hidden>
              {String(index! + 1).padStart(2, "0")} <span className="text-fg-subtle">/ {String(works.length).padStart(2, "0")}</span>
              {hasMany && <span className="ml-3 text-xs text-fg-subtle sm:hidden">Deslizá para ver más</span>}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Cerrar"
            >
              <CloseIcon className="size-6" />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-4 sm:px-20"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipeStart.current = null)}
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            {/* La foto chica (ya cargada en la grilla) queda debajo mientras llega la grande. */}
            <div
              key={work.id}
              className="relative h-full max-h-full max-w-full animate-fade"
              style={{ aspectRatio: `${work.image.width} / ${work.image.height}`, viewTransitionName: "obra-activa" }}
            >
              <Image
                src={work.image.src}
                alt=""
                fill
                draggable={false}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="rounded-md object-contain"
              />
              <Image
                src={work.image.src}
                alt={work.image.alt}
                fill
                priority
                draggable={false}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="rounded-md object-contain select-none"
              />
            </div>

            {hasMany && (
              <>
                <NavButton direction="previous" onClick={() => go(-1)} />
                <NavButton direction="next" onClick={() => go(1)} />
              </>
            )}
          </div>

          <div className="flex flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pb-6">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">{work.category}</p>
              <h2 className="font-display text-3xl uppercase sm:text-4xl">{work.title}</h2>
            </div>
            <div className="flex gap-2">
              <Link href={`/artist/${slug}/work/${work.id}`} onClick={onLeave} className={buttonClasses({ variant: "secondary" })}>
                Ver ficha
              </Link>
              <a href="#contacto" onClick={onClose} className={buttonClasses()}>
                Quiero algo así
              </a>
            </div>
          </div>

          <div hidden>
            {neighbors.map((neighbor) => (
              <Image
                key={neighbor.id}
                src={neighbor.image.src}
                alt=""
                width={neighbor.image.width}
                height={neighbor.image.height}
                loading="eager"
                sizes="(min-width: 1024px) 60vw, 100vw"
              />
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}

function NavButton({ direction, onClick }: { direction: "previous" | "next"; onClick: () => void }) {
  const previous = direction === "previous";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={previous ? "Trabajo anterior" : "Trabajo siguiente"}
      className={`absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-ink/60 text-fg backdrop-blur transition-colors hover:border-fg-muted hover:bg-surface-2 sm:flex ${
        previous ? "left-4" : "right-4"
      }`}
    >
      {previous ? <ArrowLeftIcon className="size-5" /> : <ArrowRightIcon className="size-5" />}
    </button>
  );
}

/**
 * Publicación de Instagram dentro del visor: foto (o video) a la izquierda y el texto a la
 * derecha; en el celular, una debajo del otro con desplazamiento.
 */
function InstagramPost({
  work,
  post,
  author,
  hasMany,
  onPrevious,
  onNext,
  onClose,
  swipeHandlers,
}: {
  work: PortfolioWork;
  post: InstagramPostInfo;
  author: PostAuthor;
  hasMany: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  swipeHandlers: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onPointerCancel: () => void;
  };
}) {
  const closeIfBackdrop = (event: { target: EventTarget; currentTarget: EventTarget }) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="relative flex h-full items-center justify-center sm:p-6 lg:px-24" onClick={closeIfBackdrop}>
      <article className="grid h-full w-full max-w-5xl grid-cols-[minmax(0,1fr)] overflow-y-auto bg-surface-1 sm:h-auto sm:max-h-full sm:rounded-xl sm:border sm:border-line lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:overflow-hidden">
        <div className="relative flex touch-pan-y items-center justify-center bg-black" {...swipeHandlers}>
          <div
            key={work.id}
            className="relative aspect-[4/5] w-full animate-fade lg:max-h-[calc(100dvh-3rem)]"
            style={{ viewTransitionName: "obra-activa" }}
          >
            {post.videoUrl ? (
              <video
                src={post.videoUrl}
                poster={work.image.src}
                controls
                autoPlay
                muted
                playsInline
                loop
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <Image
                src={work.image.src}
                alt={work.image.alt}
                fill
                priority
                draggable={false}
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-contain select-none"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col lg:min-h-0">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-black">
              {author.logoSrc ? (
                <Image src={author.logoSrc} alt="" width={30} height={10} className="w-7" />
              ) : (
                <InstagramIcon className="size-4 text-fg-muted" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{author.name}</p>
              <p className="truncate text-xs text-fg-subtle">
                {[author.location, formatDateTime(new Date(post.postedAt), null, { dateStyle: "long" })].filter(Boolean).join(" · ")}
              </p>
            </div>
          </header>

          <div className="flex-1 px-4 py-4 text-sm leading-relaxed text-fg-muted lg:overflow-y-auto">
            {post.caption ? <Caption text={post.caption} /> : <p className="text-fg-subtle">Sin descripción.</p>}
          </div>

          <InstagramStats
            likes={post.likeCount}
            comments={post.commentsCount}
            className="border-t border-line px-4 py-3 text-sm text-fg-subtle"
          />

          <div className="flex flex-col gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <a href="#contacto" onClick={onClose} className={buttonClasses({ className: "w-full" })}>
              Quiero algo así
            </a>
            <a href={post.permalink} target="_blank" rel="noopener" className={buttonClasses({ variant: "secondary", className: "w-full" })}>
              Ver en Instagram <ExternalIcon className="size-4" />
            </a>
          </div>
        </div>
      </article>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full bg-ink/60 text-fg backdrop-blur transition-colors hover:bg-surface-2 sm:top-4 sm:right-4"
        aria-label="Cerrar"
      >
        <CloseIcon className="size-6" />
      </button>
      {hasMany && (
        <div className="hidden lg:block">
          <NavButton direction="previous" onClick={onPrevious} />
          <NavButton direction="next" onClick={onNext} />
        </div>
      )}
    </div>
  );
}

/** Texto de la publicación con los saltos de línea originales y los hashtags resaltados. */
function Caption({ text }: { text: string }) {
  const parts = text.split(/((?:^|\s)#[\p{L}\p{N}_]+)/u);
  return (
    <p className="whitespace-pre-line">
      {parts.map((part, index) =>
        /#[\p{L}\p{N}_]+/u.test(part) ? (
          <span key={index} className="text-info">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}
