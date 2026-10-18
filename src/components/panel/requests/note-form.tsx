"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { addRequestNote } from "@/server/requests/panel-actions";

export function NoteForm({ requestId }: { requestId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await addRequestNote(requestId, body);
          if (result.ok) {
            setBody("");
            setError(undefined);
          } else {
            setError(result.message);
          }
        });
      }}
    >
      <TextAreaField
        label="Nueva nota"
        hint="Solo la ve tu estudio. Ej.: presupuesto, dudas, lo que hablaron por WhatsApp."
        maxLength={2000}
        rows={3}
        value={body}
        error={error}
        onChange={(event) => setBody(event.target.value)}
      />
      <Button type="submit" variant="secondary" size="sm" className="self-start" disabled={pending || body.trim() === ""}>
        {pending ? "Guardando…" : "Agregar nota"}
      </Button>
    </form>
  );
}
