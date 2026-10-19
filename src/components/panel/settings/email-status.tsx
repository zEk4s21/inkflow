import { Badge } from "@/components/ui/badge";
import type { RegionalSettings } from "@/config/regional";
import { formatDateTime } from "@/lib/format";
import type { EmailStatus } from "@/server/integrations/email";

export type EmailLogEntry = { id: string; kind: string; recipient: string; status: string; detail: string | null; createdAt: string };

const KIND_LABELS: Record<string, string> = {
  new_request_artist: "Aviso de consulta nueva (a vos)",
  request_received_client: "Confirmación de consulta (al cliente)",
};

const STATUS_META: Record<string, { label: string; tone: "success" | "neutral" | "danger" }> = {
  sent: { label: "Enviado", tone: "success" },
  skipped: { label: "No enviado", tone: "neutral" },
  failed: { label: "Falló", tone: "danger" },
};

/** Estado del proveedor de email (nunca la clave) y los últimos avisos, enviados o no. */
export function EmailStatusCard({ status, log, regional }: { status: EmailStatus; log: EmailLogEntry[]; regional: RegionalSettings }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      {status.status === "configured" ? (
        <>
          <span className="self-start">
            <Badge tone="success">Configurado</Badge>
          </span>
          <dl className="flex flex-col divide-y divide-line">
            {[
              ["Proveedor", status.providerLabel],
              ["Remitente", status.from],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-6">
                <dt className="text-fg-subtle">{label}</dt>
                <dd className="break-all text-fg sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <>
          <span className="self-start">
            <Badge tone="neutral">No configurado</Badge>
          </span>
          {status.status === "missing" ? (
            <p className="text-fg-muted">
              Falta cargar en el servidor:{" "}
              {status.missing.map((name) => (
                <code key={name} className="mx-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                  {name}
                </code>
              ))}
              . Hasta entonces INKFLOW no manda ningún email: los avisos quedan anotados abajo como &quot;No enviado&quot;.
            </p>
          ) : (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-fg-muted">
              {status.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-fg-subtle">Últimos avisos</h3>
        {log.length === 0 ? (
          <p className="text-fg-muted">Todavía no hubo avisos. Se generan cuando llega una consulta.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {log.map((entry) => {
              const meta = STATUS_META[entry.status] ?? STATUS_META.failed;
              return (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
                  <span className="flex flex-col gap-1">
                    <span>{KIND_LABELS[entry.kind] ?? entry.kind}</span>
                    <span className="text-xs text-fg-subtle">
                      {formatDateTime(new Date(entry.createdAt), regional)}
                      {entry.status === "failed" && entry.detail ? ` · ${entry.detail}` : ""}
                    </span>
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
