"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectField } from "@/components/ui/field";
import { mergeClients } from "@/server/clients/actions";

type Option = { id: string; label: string };

/** Trae a esta ficha las solicitudes y los datos de contacto de otro cliente, que deja de aparecer. */
export function MergeClient({ clientId, clientName, options }: { clientId: string; clientName: string; options: Option[] }) {
  const [sourceId, setSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const source = options.find((option) => option.id === sourceId);

  return (
    <div className="flex flex-col gap-4" aria-busy={pending || undefined}>
      <SelectField
        label="Cliente repetido"
        hint="Por ejemplo, la misma persona que escribió una vez con email y otra con WhatsApp."
        value={sourceId}
        onChange={(event) => {
          setSourceId(event.target.value);
          setError(null);
        }}
      >
        <option value="">Elegí un cliente…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <ConfirmDialog
        trigger={
          <Button variant="secondary" size="sm" disabled={!source || pending}>
            {pending ? "Uniendo…" : "Unir a esta ficha"}
          </Button>
        }
        title="¿Unir estos clientes?"
        description={`Las solicitudes de "${source?.label ?? ""}" pasan a ${clientName}, se completan los datos de contacto que falten y "${source?.label ?? ""}" deja de aparecer en la lista. No se puede deshacer.`}
        confirmLabel="Unir"
        onConfirm={() =>
          startTransition(async () => {
            const result = await mergeClients(sourceId, clientId);
            if (result.ok) setSourceId("");
            else setError(result.message);
          })
        }
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
