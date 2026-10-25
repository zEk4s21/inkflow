"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/cn";
import { categoriesWithWorks } from "@/lib/portfolio";
import type { PortfolioWork } from "@/server/artists/types";
import { PortfolioLightbox } from "./portfolio-lightbox";
import { WorkImage } from "./work-image";

const TRANSITION_NAME = "obra-activa";

/**
 * Corre el cambio con View Transitions si el navegador las soporta y el movimiento está permitido;
 * si no, lo aplica directo. `thumb` es la miniatura que viaja hacia el visor (o vuelve a la grilla).
 */
function withPhotoTransition(thumb: HTMLElement | null, update: () => void, direction: "open" | "close") {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduced || !thumb) {
    update();
    return;
  }
  // La foto tiene que tener el nombre en un solo lugar por vez: antes en la miniatura al abrir,
  // después en la miniatura al cerrar.
  if (direction === "open") thumb.style.viewTransitionName = TRANSITION_NAME;
  const transition = document.startViewTransition(() => {
    if (direction === "open") thumb.style.viewTransitionName = "";
    update();
    if (direction === "close") thumb.style.viewTransitionName = TRANSITION_NAME;
  });
  transition.finished.finally(() => {
    thumb.style.viewTransitionName = "";
  });
}

export function PortfolioGrid({ slug, works }: { slug: string; works: PortfolioWork[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbs = useRef(new Map<string, HTMLElement>());
  const categories = categoriesWithWorks(works);
  const visible = active ? works.filter((work) => work.category === active) : works;

  const open = (event: MouseEvent, index: number) => {
    // Ctrl/Cmd/clic del medio siguen abriendo la ficha en otra pestaña.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    withPhotoTransition(
      thumbs.current.get(visible[index].id) ?? null,
      () => {
        flushSync(() => setOpenIndex(index));
        dialogRef.current?.showModal();
      },
      "open",
    );
  };

  const close = () => {
    if (openIndex === null) return;
    const current = visible[openIndex];
    withPhotoTransition(
      current ? (thumbs.current.get(current.id) ?? null) : null,
      () => {
        dialogRef.current?.close();
        flushSync(() => setOpenIndex(null));
      },
      "close",
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {categories.length > 1 && (
        <div role="group" aria-label="Filtrar trabajos por categoría" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <FilterChip label="Todos" count={works.length} pressed={active === null} onClick={() => setActive(null)} />
          {categories.map((category) => (
            <FilterChip
              key={category.name}
              label={category.name}
              count={category.count}
              pressed={active === category.name}
              onClick={() => setActive(category.name)}
            />
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4" aria-live="polite">
        {visible.map((work, index) => (
          <li
            key={`${active ?? "todos"}-${work.id}`}
            data-reveal
            style={{ "--reveal-delay": `${(index % 4) * 70}ms` } as CSSProperties}
          >
            <Link
              href={`/artist/${slug}/work/${work.id}`}
              onClick={(event) => open(event, index)}
              ref={(element) => {
                if (element) thumbs.current.set(work.id, element);
                else thumbs.current.delete(work.id);
              }}
              className="group relative block overflow-hidden rounded-md bg-surface-1"
            >
              <WorkImage
                {...work.image}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="w-full transition-[transform,filter] duration-1000 ease-(--ease-out-soft) group-hover:scale-[1.06] group-hover:brightness-110"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/0 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 transition-transform duration-500 ease-(--ease-out-soft) sm:translate-y-2 sm:group-hover:translate-y-0">
                <p className="text-sm font-medium text-fg">{work.title}</p>
                <p className="text-xs text-fg-muted">{work.category}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <PortfolioLightbox
        slug={slug}
        works={visible}
        index={openIndex}
        dialogRef={dialogRef}
        onNavigate={setOpenIndex}
        onClose={close}
        onLeave={() => {
          dialogRef.current?.close();
          setOpenIndex(null);
        }}
      />
    </div>
  );
}

function FilterChip({
  label,
  count,
  pressed,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors duration-200",
        pressed ? "border-fg bg-fg text-ink" : "border-line-strong text-fg-muted hover:border-fg-muted hover:text-fg",
      )}
    >
      {label}
      <span className={cn("text-xs", pressed ? "text-ink/60" : "text-fg-subtle")}>{count}</span>
    </button>
  );
}
