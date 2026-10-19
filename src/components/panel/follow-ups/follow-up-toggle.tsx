"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setFollowUpDone } from "@/server/follow-ups/actions";

export function FollowUpToggle({ followUpId, done, label }: { followUpId: string; done: boolean; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={done ? "ghost" : "secondary"}
        loading={pending}
        aria-label={done ? `Deshacer: ${label}` : `Marcar hecho: ${label}`}
        onClick={() =>
          startTransition(async () => {
            const result = await setFollowUpDone(followUpId, !done);
            setError(result.ok ? null : result.message);
          })
        }
      >
        {done ? "Deshacer" : "Hecho"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
