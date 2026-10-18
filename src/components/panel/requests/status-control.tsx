"use client";

import { useState, useTransition } from "react";
import { SelectField } from "@/components/ui/field";
import { REQUEST_STATUS_META, REQUEST_STATUSES, type RequestStatus } from "@/config/request-status";
import { changeRequestStatus } from "@/server/requests/panel-actions";

/**
 * Cambia el estado apenas se elige; si falla, vuelve al anterior y lo avisa.
 * Al guardar, la página se vuelve a renderizar y el cambio se ve en el estado y el historial.
 */
export function StatusControl({ requestId, status }: { requestId: string; status: RequestStatus }) {
  const [value, setValue] = useState(status);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2" aria-busy={pending || undefined}>
      <SelectField
        label="Estado"
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as RequestStatus;
          const previous = value;
          setValue(next);
          setMessage(null);
          startTransition(async () => {
            const result = await changeRequestStatus(requestId, next);
            if (!result.ok) {
              setValue(previous);
              setMessage(result.message);
            }
          });
        }}
      >
        {REQUEST_STATUSES.map((option) => (
          <option key={option} value={option}>
            {REQUEST_STATUS_META[option].label}
          </option>
        ))}
      </SelectField>
      <p role="status" className="min-h-5 text-sm text-fg-muted">
        {pending ? "Guardando…" : message}
      </p>
    </div>
  );
}
