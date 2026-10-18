"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import type { SlotDay } from "@/lib/availability";
import { cn } from "@/lib/cn";
import { submitRequest, type RequestFormState } from "@/server/requests/actions";
import { useTurnstile } from "./turnstile";

const EMPTY = { name: "", email: "", phone: "", instagramHandle: "", idea: "", bodyZone: "", sizeLabel: "" };
const initialState: RequestFormState = { status: "idle" };

export function RequestForm({
  slug,
  turnstileSiteKey,
  slotDays = [],
}: {
  slug: string;
  turnstileSiteKey: string | null;
  /** Turnos libres; si no hay, el formulario queda como consulta sola. */
  slotDays?: SlotDay[];
}) {
  const [state, formAction, pending] = useActionState(submitRequest.bind(null, slug), initialState);
  const [values, setValues] = useState(EMPTY);
  const [chosenSlot, setSlot] = useState("");
  // Si la lista nueva ya no lo trae, el turno elegido se descarta solo.
  const slot = slotDays.some((day) => day.times.some((time) => time.value === chosenSlot)) ? chosenSlot : "";
  const router = useRouter();
  const captcha = useTurnstile(turnstileSiteKey);
  const resetCaptcha = captcha.reset;
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state.status === "error") resetCaptcha();
    // Si el turno dejó de estar libre mientras completaba el formulario, se vuelve a pedir la lista.
    if (state.status === "error" && state.fieldErrors?.slot) router.refresh();
  }, [state, router, resetCaptcha]);

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border border-line bg-surface-1 p-6">
        <h3 className="font-display text-3xl uppercase">¡Gracias!</h3>
        <p className="text-sm leading-relaxed text-fg-muted">
          {state.slot && "label" in state.slot
            ? `Recibí tu consulta y anoté tu pedido de turno para el ${state.slot.label}. Todavía no está reservado: te confirmo por el medio de contacto que dejaste.`
            : state.slot
              ? "Recibí tu consulta, pero no se pudo anotar el turno que elegiste. Lo coordinamos cuando te responda."
              : "Recibí tu consulta. Te respondo por el medio de contacto que dejaste."}
        </p>
      </div>
    );
  }

  const bind = (name: keyof typeof EMPTY) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [name]: event.target.value })),
  });

  return (
    <form action={formAction} noValidate className="flex min-w-0 flex-col gap-5">
      <TextAreaField
        label="Tu idea"
        required
        rows={5}
        maxLength={3000}
        hint="Qué te querés tatuar, estilo, si es para cubrir algo, referencias que tengas en mente."
        {...bind("idea")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Zona del cuerpo" maxLength={60} placeholder="Ej.: antebrazo" {...bind("bodyZone")} />
        <TextField label="Tamaño aproximado" maxLength={60} placeholder="Ej.: 15 cm" {...bind("sizeLabel")} />
      </div>
      <TextField label="Nombre" required maxLength={120} autoComplete="name" {...bind("name")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" {...bind("email")} />
        <TextField
          label="WhatsApp"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          hint="Con código de área. Dejá email, WhatsApp o los dos."
          {...bind("phone")}
        />
      </div>
      <TextField label="Instagram" autoCapitalize="none" placeholder="@usuario" {...bind("instagramHandle")} />

      {slotDays.length > 0 && <SlotPicker days={slotDays} value={slot} onChange={setSlot} error={errors.slot} />}
      <input type="hidden" name="slot" value={slot} />

      {/* Trampa para bots: invisible para personas y lectores de pantalla. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          No completar
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {captcha.widget}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" loading={pending} disabled={captcha.required && !captcha.token} className="self-start">
          {slot ? "Enviar consulta y pedir turno" : "Enviar consulta"}
        </Button>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )}
        <p className="text-xs text-fg-subtle">
          Tus datos se usan solo para responder esta consulta.
        </p>
      </div>
    </form>
  );
}

/** Elegir día y hora es opcional: sin turno, la consulta llega igual. */
function SlotPicker({ days, value, onChange, error }: { days: SlotDay[]; value: string; onChange: (slot: string) => void; error?: string }) {
  const [date, setDate] = useState<string | null>(null);
  const selectedDay = days.find((day) => day.times.some((time) => time.value === value));
  const shownDay = days.find((day) => day.date === date) ?? selectedDay ?? null;

  return (
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border border-line p-5">
      <legend className="px-2 text-sm font-medium">Turno (opcional)</legend>
      <p className="-mt-2 text-sm text-fg-subtle">
        Elegí un día y una hora si ya querés pedir turno. Queda pendiente hasta que lo confirme.
      </p>
      <div role="group" aria-label="Día" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((day) => {
          const pressed = shownDay?.date === day.date;
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={pressed}
              aria-label={day.longLabel}
              onClick={() => setDate(day.date)}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors duration-200 first-letter:uppercase",
                pressed ? "border-fg bg-fg text-ink" : "border-line-strong text-fg-muted hover:border-fg-muted hover:text-fg",
              )}
            >
              {day.label}
            </button>
          );
        })}
      </div>
      {shownDay ? (
        <div role="radiogroup" aria-label={`Horarios del ${shownDay.longLabel}`} className="flex flex-wrap gap-2">
          {shownDay.times.map((time) => (
            <label
              key={time.value}
              className={cn(
                "flex h-10 cursor-pointer items-center rounded-md border px-4 text-sm tabular-nums transition-colors duration-200",
                "has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                value === time.value ? "border-accent bg-accent/15 text-fg" : "border-line-strong text-fg-muted hover:border-fg-muted",
              )}
            >
              <input
                type="radio"
                name="slot-choice"
                value={time.value}
                checked={value === time.value}
                onChange={() => onChange(time.value)}
                className="sr-only"
              />
              {time.label}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-fg-subtle">Elegí un día para ver los horarios.</p>
      )}
      {value && selectedDay && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            Pedís turno para el {selectedDay.longLabel} a las{" "}
            {selectedDay.times.find((time) => time.value === value)?.label}.
          </span>
          <button type="button" onClick={() => onChange("")} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Sin turno
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
