"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { PAYMENT_KIND_LABELS, PAYMENT_KINDS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/config/payment";
import { recordPayment } from "@/server/payments/actions";
import type { PaymentFormInput } from "@/server/payments/schemas";

/** "Registrar pago" desde una solicitud. Propone seña si todavía no se cobró nada. */
export function NewPayment({ requestId, today, currency, firstPayment }: { requestId: string; today: string; currency: string; firstPayment: boolean }) {
  const initial: PaymentFormInput = { amount: "", kind: firstPayment ? "deposit" : "payment", method: "transfer", paidOn: today, note: "" };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        onClick={() => {
          // Con los datos de este momento: después de la primera seña se propone "Pago".
          setValues(initial);
          setOpen(true);
        }}
      >
        Registrar pago
      </Button>
    );
  }

  const bind = (name: keyof PaymentFormInput) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [name]: event.target.value })),
  });
  const close = () => {
    setOpen(false);
    setErrors({});
    setMessage(null);
  };

  return (
    <form
      noValidate
      aria-label="Registrar pago"
      className="@container flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await recordPayment(requestId, values);
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          setMessage(result.ok ? null : result.message);
          if (result.ok) close();
        });
      }}
    >
      <div className="grid gap-4 @lg:grid-cols-2">
        <TextField label={`Monto (${currency})`} required inputMode="decimal" placeholder="20.000" {...bind("amount")} />
        <SelectField label="Tipo" {...bind("kind")}>
          {PAYMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PAYMENT_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Medio" {...bind("method")}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </SelectField>
        <TextField label="Fecha" type="date" max={today} {...bind("paidOn")} />
      </div>
      <TextField label="Nota" maxLength={300} hint="Opcional. Ej.: número de operación." {...bind("note")} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" loading={pending}>
          Guardar pago
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={close}>
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
