"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { QuoteStatus } from "@/config/quote-status";
import { changeQuoteStatus, updateQuote } from "@/server/quotes/actions";
import type { QuoteFormInput, QuoteStatusChange } from "@/server/quotes/schemas";
import { QuoteForm } from "./quote-form";

/** Acciones de un presupuesto abierto (borrador o enviado). Los cerrados no muestran nada. */
export function QuoteActions({
  quoteId,
  status,
  current,
  today,
  currency,
}: {
  quoteId: string;
  status: QuoteStatus;
  current: QuoteFormInput;
  today: string;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (status !== "draft" && status !== "sent") return null;

  const change = (next: QuoteStatusChange) =>
    startTransition(async () => {
      const result = await changeQuoteStatus(quoteId, next);
      setError(result.ok ? null : result.message);
    });

  if (editing) {
    return (
      <QuoteForm
        initial={current}
        today={today}
        currency={currency}
        submitLabel="Guardar cambios"
        onSubmit={(values) => updateQuote(quoteId, values)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const withdraw = (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost" disabled={pending}>
          Retirar
        </Button>
      }
      title="Retirar el presupuesto"
      description="Queda en el historial como retirado y podés armar uno nuevo. Si ya se lo pasaste al cliente, avisale por mensaje."
      confirmLabel="Retirar"
      cancelLabel="Volver"
      onConfirm={() => change("withdrawn")}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" && (
          <>
            <Button size="sm" loading={pending} onClick={() => change("sent")}>
              Marcar enviado
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
              Editar
            </Button>
          </>
        )}
        {status === "sent" && (
          <>
            <Button size="sm" loading={pending} onClick={() => change("accepted")}>
              Aceptó
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("rejected")}>
              Rechazó
            </Button>
          </>
        )}
        {withdraw}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
