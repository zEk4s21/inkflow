import type { ReactNode } from "react";

export function PanelPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl uppercase sm:text-5xl">{title}</h1>
        {description && <p className="max-w-xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Marca honesta para funciones que todavía no están implementadas. */
export function PendingBadge({ phase }: { phase: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-3 px-2.5 py-1 text-xs text-fg-muted">
      Disponible en {phase}
    </span>
  );
}
