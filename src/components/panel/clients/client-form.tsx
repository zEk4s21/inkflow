"use client";

import { useActionState, useState } from "react";
import { FormStatus } from "@/components/panel/settings/form-status";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { updateClient } from "@/server/clients/actions";
import type { FormState } from "@/server/settings/actions";

export type ClientFormValues = { name: string; email: string; phone: string; instagramHandle: string };

const initialState: FormState = { status: "idle" };

export function ClientForm({ clientId, initial }: { clientId: string; initial: ClientFormValues }) {
  const [state, formAction, pending] = useActionState(updateClient.bind(null, clientId), initialState);
  // Campos controlados: React resetea el formulario después de la acción.
  const [values, setValues] = useState(initial);
  // Si los datos cambian desde afuera (por ejemplo, al unir otro cliente), se muestran los nuevos.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (JSON.stringify(initial) !== JSON.stringify(prevInitial)) {
    setPrevInitial(initial);
    setValues(initial);
  }
  const errors = state.fieldErrors ?? {};
  const bind = (name: keyof ClientFormValues) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [name]: event.target.value })),
  });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <TextField label="Nombre" required maxLength={120} autoComplete="off" {...bind("name")} />
      <TextField label="Email" type="email" inputMode="email" autoComplete="off" {...bind("email")} />
      <TextField label="WhatsApp" type="tel" inputMode="tel" autoComplete="off" hint="Con código de país. Ej.: 54 9 11 2233-4455" {...bind("phone")} />
      <TextField label="Instagram" autoCapitalize="none" placeholder="@usuario" {...bind("instagramHandle")} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Guardar cliente
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
