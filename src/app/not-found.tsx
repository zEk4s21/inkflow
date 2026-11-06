import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">Error 404</p>
      <h1 className="font-display text-5xl uppercase text-balance">Esta página no existe</h1>
      <p className="text-fg-muted">Puede que el link esté mal escrito o que la página ya no esté publicada.</p>
      <Link href="/" className={buttonClasses({ size: "lg" })}>
        Ir al inicio
      </Link>
    </main>
  );
}
