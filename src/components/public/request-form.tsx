"use client";

import Script from "next/script";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { submitRequest, type RequestFormState } from "@/server/requests/actions";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; theme: string; language: string }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

const EMPTY = { name: "", email: "", phone: "", instagramHandle: "", idea: "", bodyZone: "", sizeLabel: "" };
const initialState: RequestFormState = { status: "idle" };

export function RequestForm({ slug, turnstileSiteKey }: { slug: string; turnstileSiteKey: string | null }) {
  const [state, formAction, pending] = useActionState(submitRequest.bind(null, slug), initialState);
  const [values, setValues] = useState(EMPTY);
  const [token, setToken] = useState("");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  function renderWidget() {
    if (!turnstileSiteKey || !widget.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(widget.current, {
      sitekey: turnstileSiteKey,
      callback: setToken,
      "expired-callback": () => setToken(""),
      theme: "dark",
      language: "es",
    });
  }

  // Si el script ya estaba cargado (navegación del lado del cliente), se dibuja al montar.
  useEffect(renderWidget);

  // Cada token sirve una sola vez: después de un error se pide uno nuevo.
  useEffect(() => {
    if (state.status === "error" && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setToken("");
    }
  }, [state]);

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border border-line bg-surface-1 p-6">
        <h3 className="font-display text-3xl uppercase">¡Gracias!</h3>
        <p className="text-sm leading-relaxed text-fg-muted">
          Recibí tu consulta. Te respondo por el medio de contacto que dejaste.
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
    <form action={formAction} noValidate className="flex flex-col gap-5">
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

      {/* Trampa para bots: invisible para personas y lectores de pantalla. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          No completar
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={renderWidget} />
          <div ref={widget} />
          <input type="hidden" name="cf-turnstile-response" value={token} />
        </>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" loading={pending} disabled={Boolean(turnstileSiteKey) && !token} className="self-start">
          Enviar consulta
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
