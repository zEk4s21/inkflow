import type { ReactNode } from "react";

export function PublicSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line py-20 sm:py-28">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-8">
        <div data-reveal className="flex flex-col gap-3">
          <p className="flex items-center gap-3 text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">
            <span className="h-px w-8 bg-accent" aria-hidden />
            {eyebrow}
          </p>
          <h2 id={`${id}-title`} className="font-display text-5xl uppercase sm:text-6xl">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}
