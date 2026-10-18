"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { updateProfile, type FormState } from "@/server/settings/actions";
import { FormStatus } from "./form-status";

export type ProfileFormValues = {
  displayName: string;
  fullName: string;
  bio: string;
  styles: string;
  locationLabel: string;
  instagramHandle: string;
  isPublic: boolean;
};

const initialState: FormState = { status: "idle" };

export function ProfileForm({ initial, slug }: { initial: ProfileFormValues; slug: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  // Campos controlados: React resetea los formularios después de una acción y sin esto
  // se perdería lo escrito cuando la validación falla.
  const [values, setValues] = useState(initial);
  const errors = state.fieldErrors ?? {};
  const bind = (name: Exclude<keyof ProfileFormValues, "isPublic">) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [name]: event.target.value })),
  });

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-6 md:grid-cols-2">
        <TextField label="Nombre artístico" required maxLength={60} hint="Es el título grande de tu página." {...bind("displayName")} />
        <TextField label="Nombre completo" maxLength={120} {...bind("fullName")} />
      </div>
      <TextAreaField
        label="Biografía"
        rows={5}
        maxLength={2000}
        hint={`${values.bio.length}/2000 caracteres.`}
        {...bind("bio")}
      />
      <TextField label="Estilos" hint="Separados por coma. Ej.: Black & Grey, Blackwork" {...bind("styles")} />
      <div className="grid gap-6 md:grid-cols-2">
        <TextField label="Estudio" maxLength={120} hint="Ej.: Estudio privado · Banfield, Buenos Aires" {...bind("locationLabel")} />
        <TextField label="Instagram" hint="Tu usuario, con o sin @." autoCapitalize="none" {...bind("instagramHandle")} />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-line bg-surface-1 p-4">
        <input
          type="checkbox"
          name="isPublic"
          checked={values.isPublic}
          onChange={(event) => setValues((prev) => ({ ...prev, isPublic: event.target.checked }))}
          className="mt-0.5 size-5 accent-(--color-accent)"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg">Página publicada</span>
          <span className="text-sm text-fg-muted">
            {values.isPublic
              ? `Cualquiera puede verla en /artist/${slug}.`
              : `Oculta: /artist/${slug} devuelve "no encontrada".`}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Guardar perfil
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
