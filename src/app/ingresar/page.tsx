import type { Metadata } from "next";
import { Suspense } from "react";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export const metadata: Metadata = { title: "Ingresar · INKFLOW" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-2">
        <span className="font-display text-xl uppercase">Inkflow</span>
        <h1 className="font-display text-5xl uppercase">Entrá a tu panel</h1>
        <p className="text-sm leading-relaxed text-fg-muted">
          Te mandamos un link a tu email. Sin contraseñas.
        </p>
      </div>
      <Suspense>
        <MagicLinkForm />
      </Suspense>
    </main>
  );
}
