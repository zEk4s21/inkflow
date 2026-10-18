"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import type { QuoteActionResult } from "@/server/quotes/actions";
import type { QuoteFormInput } from "@/server/quotes/schemas";

export const EMPTY_QUOTE: QuoteFormInput = { amount: "", deposit: "", estimatedSessions: "", validUntil: "", message: "" };

/**
 * Monto, seña, sesiones, vigencia y mensaje. Con `onSend` muestra además "Guardar y marcar enviado":
 * INKFLOW todavía no le manda el presupuesto al cliente, solo deja anotado que se lo pasaste.
 */
export function QuoteForm({
  initial,
  today,
  currency,
  submitLabel,
  onSubmit,
  onSend,
  onCancel,
}: {
  initial: QuoteFormInput;
  today: string;
  currency: string;
  submitLabel: string;
  onSubmit: (values: QuoteFormInput) => Promise<QuoteActionResult>;
  onSend?: (values: QuoteFormInput) => Promise<QuoteActionResult>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bind = (name: keyof QuoteFormInput) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [name]: event.target.value })),
  });
  const run = (action: (values: QuoteFormInput) => Promise<QuoteActionResult>) =>
    startTransition(async () => {
      const result = await action(values);
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      setMessage(result.ok ? null : result.message);
      if (result.ok) onCancel?.();
    });

  return (
    <form
      noValidate
      aria-label="Presupuesto"
      className="@container flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(onSubmit);
      }}
    >
      <div className="grid gap-4 @lg:grid-cols-2">
        <TextField label={`Total (${currency})`} required inputMode="decimal" placeholder="45.000" {...bind("amount")} />
        <TextField label="Seña" inputMode="decimal" hint="Opcional." {...bind("deposit")} />
        <TextField label="Sesiones estimadas" type="number" min={1} max={20} inputMode="numeric" {...bind("estimatedSessions")} />
        <TextField label="Válido hasta" type="date" min={today} {...bind("validUntil")} />
      </div>
      <TextAreaField label="Mensaje para el cliente" maxLength={1000} className="min-h-20" hint="Qué incluye, condiciones de la seña, etc." {...bind("message")} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={onSend ? "secondary" : "primary"} loading={pending}>
          {submitLabel}
        </Button>
        {onSend && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(onSend)}>
            Guardar y marcar enviado
          </Button>
        )}
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
            Volver
          </Button>
        )}
      </div>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </form>
  );
}
