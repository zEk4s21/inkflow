"use client";

import { useEffect } from "react";

/**
 * Marca con data-revealed los elementos [data-reveal] a medida que entran en pantalla (una sola vez).
 * El efecto visual está en globals.css; sin JavaScript o con "reducir movimiento" todo se ve igual.
 */
export function ScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const observe = () => {
      document.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((element) => observer.observe(element));
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
