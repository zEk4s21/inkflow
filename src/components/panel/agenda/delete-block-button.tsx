"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteBlock } from "@/server/availability/actions";

export function DeleteBlockButton({ blockId, label }: { blockId: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Quitar bloqueo ${label}`}
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteBlock(blockId);
            setError(result.ok ? null : result.message);
          })
        }
      >
        Quitar
      </Button>
    </span>
  );
}
