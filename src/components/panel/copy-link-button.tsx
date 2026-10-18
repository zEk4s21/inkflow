"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <Button variant="secondary" onClick={copy} aria-live="polite">
      {state === "copied" ? "Link copiado" : state === "error" ? "No se pudo copiar" : "Copiar link de mi página"}
    </Button>
  );
}
