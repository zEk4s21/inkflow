"use client";

import { useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClientLink, revokeClientLink } from "@/server/client-link/actions";

/**
 * Link privado para que el cliente siga su consulta. Se muestra una sola vez al generarlo (en la
 * base queda solo el hash): si se pierde, se genera otro y el anterior deja de andar.
 */
export function ClientLink({
  requestId,
  activeSince,
  phone,
}: {
  requestId: string;
  /** Cuándo se generó el link vigente, ya formateado; null si no hay. */
  activeSince: string | null;
  /** Teléfono del cliente (solo dígitos) para mandarlo por WhatsApp. */
  phone: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      const result = await createClientLink(requestId);
      setUrl(result.ok ? result.url : null);
      setError(result.ok ? null : result.message);
      setCopied(false);
    });
  const revoke = () =>
    startTransition(async () => {
      const result = await revokeClientLink(requestId);
      setUrl(null);
      setError(result.ok ? null : result.message);
    });
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError("No se pudo copiar: seleccioná el link y copialo a mano.");
    }
  }

  const replaceWarning = "El link anterior deja de funcionar. Si ya se lo pasaste al cliente, mandale el nuevo.";

  return (
    <div className="flex flex-col gap-3 text-sm">
      {url ? (
        <div className="flex flex-col gap-3">
          <p className="text-fg-muted">Copialo ahora: por seguridad no se vuelve a mostrar.</p>
          <input
            readOnly
            value={url}
            aria-label="Link para el cliente"
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => copy(url)} aria-live="polite">
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
            {phone && (
              <a
                href={`https://wa.me/${phone}?text=${encodeURIComponent(`Acá podés ver cómo va tu consulta: ${url}`)}`}
                target="_blank"
                rel="noopener"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Mandar por WhatsApp
              </a>
            )}
          </div>
        </div>
      ) : activeSince ? (
        <p className="text-fg-muted">Hay un link activo desde el {activeSince}.</p>
      ) : (
        <p className="text-fg-muted">El cliente puede ver el estado, el presupuesto enviado y sus turnos. Nunca ve tus notas.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {activeSince || url ? (
          <>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="secondary" disabled={pending}>
                  Generar uno nuevo
                </Button>
              }
              title="Generar un link nuevo"
              description={replaceWarning}
              confirmLabel="Generar"
              cancelLabel="Volver"
              onConfirm={generate}
            />
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost" disabled={pending}>
                  Desactivar
                </Button>
              }
              title="Desactivar el link"
              description="Quien tenga el link deja de ver la consulta. Podés generar otro cuando quieras."
              confirmLabel="Desactivar"
              cancelLabel="Volver"
              onConfirm={revoke}
            />
          </>
        ) : (
          <Button size="sm" variant="secondary" loading={pending} onClick={generate}>
            Generar link
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
