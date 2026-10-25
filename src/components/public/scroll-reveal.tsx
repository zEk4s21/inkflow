"use client";

import { useEffect } from "react";

/**
 * Anima los elementos [data-reveal] cada vez que entran en pantalla, al bajar y al subir: al salir
 * se anota por qué lado (data-reveal-side) para que vuelvan a entrar desde ese lado. El efecto
 * visual está en globals.css; sin JavaScript o con "reducir movimiento" todo se ve quieto.
 */
export function ScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target;
          if (entry.isIntersecting) {
            element.setAttribute("data-revealed", "");
          } else {
            element.removeAttribute("data-revealed");
            const side = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) ? "above" : "below";
            element.setAttribute("data-reveal-side", side);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const observed = new WeakSet<Element>();
    const observe = () => {
      document.querySelectorAll("[data-reveal]").forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        observer.observe(element);
      });
    };
    observe();
    // El portfolio cambia al filtrar: los trabajos nuevos también se observan.
    const mutations = new MutationObserver(observe);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
  return null;
}
