"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { categoriesWithWorks } from "@/lib/portfolio";
import type { PortfolioWork } from "@/server/artists/types";
import { WorkImage } from "./work-image";

export function PortfolioGrid({ slug, works }: { slug: string; works: PortfolioWork[] }) {
  const [active, setActive] = useState<string | null>(null);
  const categories = categoriesWithWorks(works);
  const visible = active ? works.filter((work) => work.category === active) : works;

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
          <li key={work.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
            <Link
              href={`/artist/${slug}/work/${work.id}`}
              className="group relative block overflow-hidden rounded-md bg-surface-1"
            >
              <WorkImage
                {...work.image}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="w-full transition-transform duration-700 ease-(--ease-out-soft) group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-3 pt-10">
                <p className="text-sm font-medium text-fg">{work.title}</p>
                <p className="text-xs text-fg-muted">{work.category}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
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
