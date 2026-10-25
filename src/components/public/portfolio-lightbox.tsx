"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { PortfolioWork } from "@/server/artists/types";

/** Distancia mínima (px) de un deslizamiento horizontal para pasar de foto. */
const SWIPE_THRESHOLD = 50;

/**
 * Visor a pantalla completa del portfolio: flechas, teclado (← → Esc) y deslizar en el celular.
 * Lo abre y cierra PortfolioGrid (con transición de la foto si el navegador la soporta).
 */
export function PortfolioLightbox({
  slug,
  works,
  index,
  dialogRef,
  onNavigate,
  onClose,
  onLeave,
}: {
  slug: string;
  works: PortfolioWork[];
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
      {work && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8 sm:py-5">
            <p className="text-sm tabular-nums text-fg-muted" aria-hidden>
              {String(index! + 1).padStart(2, "0")} <span className="text-fg-subtle">/ {String(works.length).padStart(2, "0")}</span>
              {hasMany && <span className="ml-3 text-xs text-fg-subtle sm:hidden">Deslizá para ver más</span>}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full text-2xl text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Cerrar"
            >
              ✕
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
      className={`absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-ink/60 text-xl text-fg backdrop-blur transition-colors hover:border-fg-muted hover:bg-surface-2 sm:flex ${
        previous ? "left-4" : "right-4"
      }`}
    >
      {previous ? "←" : "→"}
    </button>
  );
}
