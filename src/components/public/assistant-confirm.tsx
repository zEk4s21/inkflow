"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import type { Brief } from "@/server/assistant/brief";
import type { ConfirmState } from "@/server/assistant/state";

/**
 * Revisión final: el resumen que armó el asistente, editable, más los datos de contacto. Los
 * campos son controlados para no perder lo escrito si el envío vuelve con errores.
 */
export function AssistantConfirm({
  brief,
  state,
  action,
  pending,
  onBack,
}: {
  brief: Brief;
  state: ConfirmState;
  action: (formData: FormData) => void;
  pending: boolean;
  onBack: () => void;
}) {
  const [values, setValues] = useState({
    idea: brief.idea ?? "",
    bodyZone: brief.bodyZone ?? "",
    sizeLabel: brief.sizeLabel ?? "",
    style: brief.style ?? "",
    colorMode: brief.colorMode ?? "",
    isCoverUp: brief.isCoverUp === true ? "yes" : brief.isCoverUp === false ? "no" : "",
    details: brief.notes ?? "",
    name: "",
    email: "",
    phone: "",
    instagramHandle: "",
    confirmed: false,
  });
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const bind = (name: Exclude<keyof typeof values, "confirmed">) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <form action={action} noValidate aria-label="Revisar y enviar" className="flex flex-col gap-5 self-start rounded-lg border border-line bg-surface-1 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">Revisá y enviá</h2>
        <p className="text-sm text-fg-muted">Podés corregir lo que haga falta. Nada se envía hasta que lo confirmes.</p>
      </div>

      <TextAreaField label="Idea" required maxLength={3000} className="min-h-28" {...bind("idea")} />
      <TextField label="Zona del cuerpo" maxLength={60} {...bind("bodyZone")} />
      <TextField label="Tamaño" maxLength={60} {...bind("sizeLabel")} />
      <TextField label="Estilo" maxLength={60} {...bind("style")} />
      <SelectField label="Color" {...bind("colorMode")}>
        <option value="">Sin indicar</option>
        <option value="black_grey">Negro y grises</option>
        <option value="color">Color</option>
      </SelectField>
      <SelectField label="¿Cubre otro tatuaje?" {...bind("isCoverUp")}>
        <option value="">Sin indicar</option>
        <option value="no">No</option>
        <option value="yes">Sí</option>
      </SelectField>
      <TextAreaField label="Otros detalles" maxLength={500} className="min-h-20" {...bind("details")} />

      <div className="flex flex-col gap-5 border-t border-line pt-5">
        <h3 className="text-sm font-medium">Para responderte</h3>
        <TextField label="Nombre" required autoComplete="name" {...bind("name")} />
        <TextField label="Email" type="email" autoComplete="email" {...bind("email")} />
        <TextField
          label="WhatsApp"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          hint="Con código de área. Dejá email, WhatsApp o los dos."
          {...bind("phone")}
        />
        <TextField label="Instagram" autoCapitalize="none" placeholder="@usuario" {...bind("instagramHandle")} />
      </div>

      {/* Trampa para bots: invisible para personas y lectores de pantalla. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          No completar
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="confirmed"
            checked={values.confirmed}
            onChange={(event) => setValues((current) => ({ ...current, confirmed: event.target.checked }))}
            className="mt-0.5 size-5 shrink-0 accent-(--color-accent)"
          />
          <span>Revisé el resumen y quiero enviar la consulta.</span>
        </label>
        {errors.confirmed && <p className="text-sm text-danger">{errors.confirmed}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Enviar consulta
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
          Volver al chat
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      <p className="text-xs text-fg-subtle">Tus datos se usan solo para responder esta consulta y no pasan por el asistente.</p>
    </form>
  );
}
