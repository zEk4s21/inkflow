"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { WEEKDAY_LABELS, type Weekday, type WeeklyRule } from "@/lib/availability";
import { cn } from "@/lib/cn";
import { saveWeeklyAvailability } from "@/server/availability/actions";
import { BUFFER_OPTIONS, SLOT_OPTIONS } from "@/server/availability/schemas";

type Day = { weekday: Weekday; enabled: boolean; start: string; end: string };

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function durationLabel(minutes: number) {
  if (minutes === 0) return "Sin margen";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString("es-AR")} ${hours === 1 ? "hora" : "horas"}`;
}

/** v1: una franja por día. Si la base tiene más de una (cargadas a mano), se edita la primera. */
function toDays(rules: WeeklyRule[]): Day[] {
  return WEEKDAYS.map((weekday) => {
    const rule = rules.find((item) => item.weekday === weekday);
    return { weekday, enabled: Boolean(rule), start: rule?.start ?? "10:00", end: rule?.end ?? "18:00" };
  });
}

export function WeeklyEditor({ rules }: { rules: WeeklyRule[] }) {
  const [days, setDays] = useState(() => toDays(rules));
  const [slotMinutes, setSlotMinutes] = useState(rules[0]?.slotMinutes ?? 180);
  const [bufferMinutes, setBufferMinutes] = useState(rules[0]?.bufferMinutes ?? 30);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (index: number, patch: Partial<Day>) => setDays((prev) => prev.map((day, i) => (i === index ? { ...day, ...patch } : day)));

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveWeeklyAvailability({ days, slotMinutes, bufferMinutes });
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          setMessage(result.ok ? { tone: "ok", text: "Horario guardado." } : { tone: "error", text: result.message });
        });
      }}
    >
      <fieldset className="flex flex-col divide-y divide-line rounded-lg border border-line">
        <legend className="sr-only">Días y horarios</legend>
        {days.map((day, index) => {
          const label = WEEKDAY_LABELS[day.weekday];
          const error = errors[`days.${index}.end`] ?? errors[`days.${index}.start`];
          return (
            <div key={day.weekday} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex w-36 shrink-0 items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(event) => update(index, { enabled: event.target.checked })}
                  className="size-5 accent-(--color-accent)"
                />
                {label}
              </label>
              {day.enabled ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      aria-label={`${label}: desde`}
                      value={day.start}
                      step={900}
                      onChange={(event) => update(index, { start: event.target.value })}
                      className={cn("h-10 rounded-md border bg-surface-1 px-3", error ? "border-danger" : "border-line")}
                    />
                    <span className="text-fg-subtle">a</span>
                    <input
                      type="time"
                      aria-label={`${label}: hasta`}
                      value={day.end}
                      step={900}
                      onChange={(event) => update(index, { end: event.target.value })}
                      className={cn("h-10 rounded-md border bg-surface-1 px-3", error ? "border-danger" : "border-line")}
                    />
                  </div>
                  {error && <p className="text-sm text-danger">{error}</p>}
                </div>
              ) : (
                <span className="text-sm text-fg-subtle">No trabaja</span>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Duración de cada turno"
          hint="Cuánto reservás por sesión."
          value={slotMinutes}
          onChange={(event) => setSlotMinutes(Number(event.target.value))}
        >
          {SLOT_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {durationLabel(minutes)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Margen entre turnos"
          hint="Para limpiar y armar entre un cliente y otro."
          value={bufferMinutes}
          onChange={(event) => setBufferMinutes(Number(event.target.value))}
        >
          {BUFFER_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {durationLabel(minutes)}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Guardar horario
        </Button>
        <p role="status" className={cn("text-sm", message?.tone === "error" ? "text-danger" : "text-success")}>
          {message?.text}
        </p>
      </div>
    </form>
  );
}
