"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import type { AppointmentResult } from "@/server/appointments/actions";
import type { AppointmentTimeInput } from "@/server/appointments/schemas";

const DURATIONS = [60, 90, 120, 180, 240, 300, 360, 480];

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Día, hora y duración de un turno. Lo usan "Dar turno" y "Reprogramar". */
export function AppointmentTimeForm({
  initial,
  today,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: AppointmentTimeInput;
  today: string;
  submitLabel: string;
  onSubmit: (values: AppointmentTimeInput) => Promise<AppointmentResult>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const durations = DURATIONS.includes(values.durationMinutes) ? DURATIONS : [...DURATIONS, values.durationMinutes].sort((a, b) => a - b);

  return (
    <form
      noValidate
      className="@container flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await onSubmit(values);
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          setMessage(result.ok ? null : result.message);
          if (result.ok) onCancel?.();
        });
      }}
    >
      {/* Se usa en columnas angostas (ficha de la solicitud) y anchas: se acomoda al contenedor. */}
      <div className="grid gap-4 @lg:grid-cols-3">
        <TextField
          label="Día"
          type="date"
          min={today}
          value={values.date}
          error={errors.date}
          onChange={(event) => setValues((prev) => ({ ...prev, date: event.target.value }))}
        />
        <TextField
          label="Hora"
          type="time"
          step={900}
          value={values.time}
          error={errors.time}
          onChange={(event) => setValues((prev) => ({ ...prev, time: event.target.value }))}
        />
        <SelectField
          label="Duración"
          value={String(values.durationMinutes)}
          error={errors.durationMinutes}
          onChange={(event) => setValues((prev) => ({ ...prev, durationMinutes: Number(event.target.value) }))}
        >
          {durations.map((minutes) => (
            <option key={minutes} value={minutes}>
              {durationLabel(minutes)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Volver
          </Button>
        )}
        {message && (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
