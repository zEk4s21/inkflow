"use client";

import { useState, useTransition } from "react";
import { WorkImage } from "@/components/public/work-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteWork, moveWork, setWorkPublished, updateWork, type WorkActionResult } from "@/server/portfolio/actions";
import { WorkFields, type WorkFieldValues } from "./work-fields";

export type PanelWork = {
  id: string;
  title: string;
  category: string;
  bodyZone: string | null;
  description: string | null;
  altText: string;
  published: boolean;
  image: { src: string; width: number; height: number };
};

export function WorkCard({
  work,
  categories,
  canEdit,
  isFirst,
  isLast,
}: {
  work: PanelWork;
  categories: string[];
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<WorkFieldValues>(() => toValues(work));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<WorkActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setErrors({});
        setMessage(null);
        onSuccess?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface-1/40 p-3" aria-busy={pending || undefined}>
      <div className="flex gap-3">
        <WorkImage {...work.image} alt={work.altText} sizes="96px" className="w-24 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate font-medium">{work.title}</span>
          <span className="text-xs text-fg-subtle">
            {[work.category, work.bodyZone].filter(Boolean).join(" · ")}
          </span>
          <span>{work.published ? <Badge tone="success">Publicado</Badge> : <Badge>Borrador</Badge>}</span>
        </div>
      </div>

      {canEdit && !editing && (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setWorkPublished(work.id, !work.published))}>
            {work.published ? "Ocultar" : "Publicar"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending || isFirst} aria-label={`Subir ${work.title}`} onClick={() => run(() => moveWork(work.id, -1))}>
            ↑
          </Button>
          <Button size="sm" variant="ghost" disabled={pending || isLast} aria-label={`Bajar ${work.title}`} onClick={() => run(() => moveWork(work.id, 1))}>
            ↓
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="danger" disabled={pending}>
                Borrar
              </Button>
            }
            title="¿Borrar este trabajo?"
            description={`"${work.title}" deja de verse en tu página y la foto se elimina. No se puede deshacer.`}
            confirmLabel="Borrar"
            onConfirm={() => run(() => deleteWork(work.id))}
          />
        </div>
      )}

      {editing && (
        <form
          noValidate
          className="flex flex-col gap-5 border-t border-line pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => updateWork(work.id, values), () => setEditing(false));
          }}
        >
          <WorkFields values={values} onChange={setValues} errors={errors} categories={categories} idPrefix={work.id} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" loading={pending}>
              Guardar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setValues(toValues(work));
                setErrors({});
                setMessage(null);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p role="status" className="text-sm text-danger">
          {message}
        </p>
      )}
    </li>
  );
}

function toValues(work: PanelWork): WorkFieldValues {
  return {
    title: work.title,
    category: work.category,
    bodyZone: work.bodyZone ?? "",
    description: work.description ?? "",
    altText: work.altText === work.title ? "" : work.altText,
    published: work.published,
  };
}
