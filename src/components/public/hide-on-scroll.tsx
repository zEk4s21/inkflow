"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Recorrido mínimo (px) para cambiar de estado, así un temblor del dedo no hace parpadear el menú. */
const MIN_DELTA = 8;
/** Arriba de todo el menú siempre se ve. */
const ALWAYS_VISIBLE_UNTIL = 120;
/** Tiempo que dura el desplazamiento suave al saltar a una sección. */
const ANCHOR_JUMP_MS = 1200;

/** Esconde el encabezado al bajar y lo vuelve a mostrar al subir (o si algo de adentro tiene el foco). */
export function HideOnScroll({ className, children }: { className?: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const jumpingUntil = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    // Al saltar a una sección (#contacto, "Ver trabajos"...) el menú se esconde durante todo el
    // recorrido, suba o baje: así el título de la sección queda arriba sin hueco ni tapado.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href*='#']");
      if (!(link instanceof HTMLAnchorElement) || link.pathname !== window.location.pathname || !link.hash) return;
      jumpingUntil.current = Date.now() + ANCHOR_JUMP_MS;
      setHidden(true);
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (Date.now() < jumpingUntil.current) {
        lastY.current = y;
        return;
      }
      const delta = y - lastY.current;
      if (Math.abs(delta) < MIN_DELTA) return;
      setHidden(delta > 0 && y > ALWAYS_VISIBLE_UNTIL);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <header
      data-hidden={hidden || undefined}
      onFocus={() => setHidden(false)}
      className={`transition-transform duration-500 ease-(--ease-out-soft) data-hidden:-translate-y-full ${className ?? ""}`}
    >
      {children}
    </header>
  );
}
