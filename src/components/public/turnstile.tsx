"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; theme: string; language: string }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

/**
 * Captcha de Cloudflare Turnstile. Sin `siteKey` (local sin captcha) no dibuja nada y el token
 * queda vacío. `widget` va dentro del formulario: incluye el campo oculto con el token.
 */
export function useTurnstile(siteKey: string | null) {
  const [token, setToken] = useState("");
  const element = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!siteKey || !element.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(element.current, {
      sitekey: siteKey,
      callback: setToken,
      "expired-callback": () => setToken(""),
      theme: "dark",
      language: "es",
    });
  }, [siteKey]);

  // Si el script ya estaba cargado (navegación del lado del cliente), se dibuja al montar.
  useEffect(render);

  /** Cada token sirve una sola vez: después de un error se pide uno nuevo. */
  const reset = useCallback(() => {
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setToken("");
    }
  }, []);

  const widget = siteKey ? (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={render} />
      <div ref={element} />
      <input type="hidden" name="cf-turnstile-response" value={token} />
    </>
  ) : null;

  return { token, reset, widget, required: Boolean(siteKey) };
}
