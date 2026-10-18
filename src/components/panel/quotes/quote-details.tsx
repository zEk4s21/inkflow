import { Badge } from "@/components/ui/badge";
import type { RegionalSettings } from "@/config/regional";
import { QUOTE_STATUS_META } from "@/config/quote-status";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Quote } from "@/server/quotes/queries";

/** Monto, seña, sesiones, vigencia y mensaje de un presupuesto, con su estado. */
export function QuoteDetails({ quote, regional }: { quote: Quote; regional: RegionalSettings }) {
  const meta = QUOTE_STATUS_META[quote.status];
  const money = (amount: number) => formatMoney(amount, { ...regional, currency: quote.currency });
  // valid_until es una fecha sin hora: se formatea en UTC para que no cambie de día.
  const validUntil = quote.validUntil
    ? formatDateTime(new Date(`${quote.validUntil}T00:00:00Z`), { ...regional, timeZone: "UTC" }, { dateStyle: "medium" })
    : null;
  const when =
    quote.respondedAt ? `${meta.label} el ${formatDateTime(new Date(quote.respondedAt), regional)}`
    : quote.sentAt ? `Enviado el ${formatDateTime(new Date(quote.sentAt), regional)}`
    : `Creado el ${formatDateTime(new Date(quote.createdAt), regional)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-serif text-2xl tabular-nums">{money(quote.amount)}</span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-fg-subtle">Seña</dt>
          <dd className="tabular-nums">{quote.deposit === null ? "Sin seña" : money(quote.deposit)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-fg-subtle">Sesiones</dt>
          <dd>{quote.estimatedSessions ?? "Sin indicar"}</dd>
        </div>
        {validUntil && (
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="text-fg-subtle">Válido hasta</dt>
            <dd>{validUntil}</dd>
          </div>
        )}
        {quote.message && (
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="text-fg-subtle">Mensaje</dt>
            <dd className="whitespace-pre-line">{quote.message}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-fg-subtle">{when}</p>
    </div>
  );
}
