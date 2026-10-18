import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <div className="size-10 rounded-full border border-line-strong" aria-hidden>
        <div className="m-auto mt-[18px] h-px w-4 bg-fg-subtle" />
      </div>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="font-display text-2xl text-fg">{title}</h3>
        <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
