"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createQuote } from "@/server/quotes/actions";
import { EMPTY_QUOTE, QuoteForm } from "./quote-form";

/** "Armar presupuesto" desde una solicitud: se guarda como borrador o ya marcado como enviado. */
export function NewQuote({ requestId, today, currency }: { requestId: string; today: string; currency: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        Armar presupuesto
      </Button>
    );
  }
  return (
    <QuoteForm
      initial={EMPTY_QUOTE}
      today={today}
      currency={currency}
      submitLabel="Guardar borrador"
      onSubmit={(values) => createQuote(requestId, values, false)}
      onSend={(values) => createQuote(requestId, values, true)}
      onCancel={() => setOpen(false)}
    />
  );
}
