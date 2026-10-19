"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { addFollowUp } from "@/server/follow-ups/actions";
import type { FollowUpFormInput } from "@/server/follow-ups/schemas";

/** Un control a mano desde la solicitud (por ejemplo, "mandar foto del diseño"). */
export function NewFollowUp({ requestId, defaultDate }: { requestId: string; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FollowUpFormInput>({ dueOn: defaultDate, note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
        Agregar control
      </Button>
    );
  }

  return (
    <form
      noValidate
      aria-label="Agregar control"
      className="@container flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await addFollowUp(requestId, values);
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          setMessage(result.ok ? null : result.message);
          if (result.ok) {
            setOpen(false);
            setValues({ dueOn: defaultDate, note: "" });
          }
        });
      }}
    >
      <div className="grid gap-4 @lg:grid-cols-[10rem_1fr]">
        <TextField
          label="Fecha"
          type="date"
          value={values.dueOn}
          error={errors.dueOn}
          onChange={(event) => setValues((prev) => ({ ...prev, dueOn: event.target.value }))}
        />
        <TextField
          label="Qué hacer"
          required
          maxLength={300}
          value={values.note}
          error={errors.note}
          onChange={(event) => setValues((prev) => ({ ...prev, note: event.target.value }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" loading={pending}>
          Guardar control
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Volver
        </Button>
      </div>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </form>
  );
}
