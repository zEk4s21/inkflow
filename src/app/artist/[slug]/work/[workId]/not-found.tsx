"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";

/** Trabajo borrado u oculto: se vuelve al portfolio del mismo tatuador. */
export default function WorkNotFound() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">Error 404</p>
      <h1 className="font-display text-5xl uppercase text-balance">Este trabajo ya no está publicado</h1>
      <p className="text-fg-muted">Mirá el resto del portfolio o contame tu idea.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/artist/${slug}#trabajos`} className={buttonClasses({ size: "lg" })}>
          Ver trabajos
        </Link>
        <Link href={`/artist/${slug}#contacto`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          Contacto
        </Link>
      </div>
    </main>
  );
}
