"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteRequestNote } from "@/server/requests/panel-actions";

export function DeleteNoteButton({ noteId }: { noteId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-2">
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="ghost" disabled={pending}>
            Borrar
          </Button>
        }
        title="¿Borrar esta nota?"
        description="La nota deja de verse en la solicitud."
        confirmLabel="Borrar"
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteRequestNote(noteId);
            setError(result.ok ? null : result.message);
          })
        }
      />
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
