"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { voidPayment } from "@/server/payments/actions";

export function VoidPaymentButton({ paymentId, label }: { paymentId: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex flex-col items-end gap-1">
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="ghost" disabled={pending} aria-label={`Anular ${label}`}>
            Anular
          </Button>
        }
        title="Anular el pago"
        description={`${label} queda tachado y deja de sumar. No se borra: si estaba mal, cargalo de nuevo.`}
        confirmLabel="Anular"
        cancelLabel="Volver"
        onConfirm={() =>
          startTransition(async () => {
            const result = await voidPayment(paymentId);
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
