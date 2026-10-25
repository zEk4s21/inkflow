"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Recorrido mínimo (px) para cambiar de estado, así un temblor del dedo no hace parpadear el menú. */
const MIN_DELTA = 8;
/** Arriba de todo el menú siempre se ve. */
const ALWAYS_VISIBLE_UNTIL = 120;

/** Esconde el encabezado al bajar y lo vuelve a mostrar al subir (o si algo de adentro tiene el foco). */
export function HideOnScroll({ className, children }: { className?: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < MIN_DELTA) return;
      setHidden(delta > 0 && y > ALWAYS_VISIBLE_UNTIL);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
