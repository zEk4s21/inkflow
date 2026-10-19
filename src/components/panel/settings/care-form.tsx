"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { updateCareInstructions, type FormState } from "@/server/settings/actions";
import { FormStatus } from "./form-status";

const initialState: FormState = { status: "idle" };

/** Texto libre: lo escribe el tatuador con su forma de trabajar. INKFLOW no trae uno armado. */
export function CareForm({ initial }: { initial: string }) {
  const [state, formAction, pending] = useActionState(updateCareInstructions, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextAreaField
        label="Indicaciones de cuidado"
        name="careInstructions"
        defaultValue={initial}
        maxLength={4000}
        rows={10}
        error={state.fieldErrors?.careInstructions}
        hint="El cliente las ve en su link cuando la sesión ya se hizo. Si lo dejás vacío, no se muestra nada."
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Guardar cuidados
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
