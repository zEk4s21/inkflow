"use client";

import { useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

/**
 * Confirmación para acciones destructivas. Usa <dialog> nativo:
 * foco atrapado, Escape para cerrar y fondo inerte sin dependencias.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  /** Para cuando "Cancelar" se confunde con la acción (por ejemplo, cancelar un turno). */
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <span onClick={() => ref.current?.showModal()}>{trigger}</span>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-lg border border-line bg-surface-1 p-6 text-fg shadow-soft backdrop:bg-ink/70 backdrop:backdrop-blur-sm open:animate-rise"
      >
        <h2 id={titleId} className="font-display text-2xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              ref.current?.close();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
