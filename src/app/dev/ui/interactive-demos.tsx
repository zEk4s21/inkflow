"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function InteractiveDemos() {
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        loading={loading}
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 1500);
        }}
      >
        {loading ? "Enviando…" : "Probar estado de carga"}
      </Button>
      <ConfirmDialog
        trigger={<Button variant="danger">{deleted ? "Eliminado (demo)" : "Eliminar trabajo"}</Button>}
        title="¿Eliminar este trabajo?"
        description="Se va a quitar de tu portfolio público. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => setDeleted(true)}
      />
    </div>
  );
}
