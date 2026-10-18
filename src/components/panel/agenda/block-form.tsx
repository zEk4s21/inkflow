"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { addBlock } from "@/server/availability/actions";
import type { BlockInput } from "@/server/availability/schemas";

export function BlockForm({ today }: { today: string }) {
  const empty: BlockInput = { startDate: today, endDate: today, allDay: true, startTime: "10:00", endTime: "14:00", reason: "" };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<BlockInput>) => setValues((prev) => ({ ...prev, ...patch }));

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await addBlock(values);
          if (result.ok) {
            setValues(empty);
            setErrors({});
            setMessage(null);
          } else {
            setErrors(result.fieldErrors ?? {});
            setMessage(result.message);
          }
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Desde"
          type="date"
          min={today}
          value={values.startDate}
          error={errors.startDate}
          onChange={(event) => set({ startDate: event.target.value, endDate: event.target.value > values.endDate ? event.target.value : values.endDate })}
        />
        <TextField label="Hasta" type="date" min={values.startDate} value={values.endDate} error={errors.endDate} onChange={(event) => set({ endDate: event.target.value })} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={values.allDay} onChange={(event) => set({ allDay: event.target.checked })} className="size-5 accent-(--color-accent)" />
        Días completos
      </label>
      {!values.allDay && (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Desde la hora" type="time" step={900} value={values.startTime} error={errors.startTime} onChange={(event) => set({ startTime: event.target.value })} />
          <TextField label="Hasta la hora" type="time" step={900} value={values.endTime} error={errors.endTime} onChange={(event) => set({ endTime: event.target.value })} />
        </div>
      )}
      <TextField label="Motivo" hint="Solo lo ves vos. Ej.: vacaciones, convención." maxLength={120} value={values.reason} error={errors.reason} onChange={(event) => set({ reason: event.target.value })} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="secondary" loading={pending}>
          Agregar bloqueo
        </Button>
        {message && (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
