"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { requestMagicLink, type MagicLinkState } from "@/server/auth/actions";

const initialState: MagicLinkState = { status: "idle" };

export function MagicLinkForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initialState);
  const linkFailed = useSearchParams().get("error") === "link";

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border border-line bg-surface-1 p-6">
        <h2 className="font-display text-2xl uppercase">Revisá tu email</h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          Si <span className="text-fg">{state.email}</span> tiene acceso, te llegó un link para entrar. Vence en una hora.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {linkFailed && state.status === "idle" && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          El link venció o ya se usó. Pedí uno nuevo.
        </p>
      )}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.status === "error" ? state.email : undefined}
        error={state.status === "error" ? state.message : undefined}
      />
      <Button type="submit" size="lg" loading={pending}>
        Enviarme el link
      </Button>
    </form>
  );
}
