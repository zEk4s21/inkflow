import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { REQUEST_CLIENT_STATUS, REQUEST_STATUS_META } from "@/config/request-status";
import type { StatusTone } from "@/config/request-status";
import { localDateOf } from "@/lib/availability";
import { formatDateTime, formatMoney } from "@/lib/format";
import { appointmentView } from "@/server/appointments/view";
import { getClientView, type ClientView } from "@/server/client-link/view";

// Es de un solo cliente: no se indexa ni se manda en el Referer (lo refuerzan los headers de next.config).
export const metadata: Metadata = { title: "Tu consulta", robots: { index: false, follow: false } };

const QUOTE_LABEL: Record<NonNullable<ClientView["quote"]>["status"], { label: string; tone: StatusTone }> = {
  sent: { label: "Para revisar", tone: "info" },
  accepted: { label: "Aceptado", tone: "success" },
  rejected: { label: "No aceptado", tone: "neutral" },
};

const APPOINTMENT_LABEL: Record<ClientView["appointments"][number]["status"], { label: string; tone: StatusTone }> = {
  requested: { label: "A confirmar", tone: "warning" },
  confirmed: { label: "Confirmado", tone: "success" },
  completed: { label: "Realizado", tone: "neutral" },
};

export default function ClientTrackingPage({ params }: PageProps<"/seguimiento/[token]">) {
  return (
    <Suspense fallback={<TrackingSkeleton />}>
      <Tracking params={params} />
    </Suspense>
  );
}

/**
 * Se lee en cada visita: el estado cambia y el link se puede desactivar en cualquier momento.
 * Un link inválido muestra un aviso en vez de un 404: la respuesta ya empezó a enviarse cuando se
 * resuelve el token, y el aviso no dice si el link existió.
 */
async function Tracking({ params }: Pick<PageProps<"/seguimiento/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const view = await getClientView(token);
  if (!view) return <InvalidLink />;

  const { regional, request, quote } = view;
  const status = REQUEST_CLIENT_STATUS[request.status];
  const now = new Date();
  const today = localDateOf(now, regional.timeZone);
  // Un pedido de turno que pasó sin confirmarse ya no sirve: no se muestra.
  const appointments = view.appointments.filter((item) => item.status !== "requested" || item.start > now);
  const money = (amount: number) => formatMoney(amount, { ...regional, currency: quote?.currency });
  const validUntil = quote?.validUntil
    ? formatDateTime(new Date(`${quote.validUntil}T00:00:00Z`), { ...regional, timeZone: "UTC" }, { dateStyle: "long" })
    : null;
  const balance = quote ? Math.round((quote.amount - view.paid) * 100) / 100 : 0;
  const expired = quote?.status === "sent" && quote.validUntil !== null && quote.validUntil < today;

  return (
    <>
      <header className="border-b border-line/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-8">
          {view.slug ? (
            <Link href={`/artist/${view.slug}`} className="font-display text-2xl tracking-wide uppercase">
              {view.artistName}
            </Link>
          ) : (
            <span className="font-display text-2xl tracking-wide uppercase">{view.artistName}</span>
          )}
        </div>
      </header>
      <main id="contenido" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">Tu consulta</p>
          <h1 className="font-display text-5xl uppercase sm:text-6xl">Hola, {view.firstName}</h1>
          <p className="text-sm text-fg-muted">Enviada el {formatDateTime(request.createdAt, regional, { dateStyle: "long" })}.</p>
        </div>

        <Card label="Estado">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">Estado</h2>
            <Badge tone={REQUEST_STATUS_META[request.status].tone}>{status.label}</Badge>
          </div>
          <p className="leading-relaxed text-fg-muted">{status.description}</p>
        </Card>

        {quote && (
          <Card label="Presupuesto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">Presupuesto</h2>
              <Badge tone={expired ? "neutral" : QUOTE_LABEL[quote.status].tone}>{expired ? "Vencido" : QUOTE_LABEL[quote.status].label}</Badge>
            </div>
            <p className="font-serif text-4xl tabular-nums">{money(quote.amount)}</p>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Item label="Seña para reservar">{quote.deposit === null ? "Sin seña" : money(quote.deposit)}</Item>
              <Item label="Sesiones estimadas">{quote.estimatedSessions ?? "A definir"}</Item>
              {validUntil && <Item label={expired ? "Venció el" : "Válido hasta"}>{validUntil}</Item>}
            </dl>
            {quote.message && <p className="whitespace-pre-line leading-relaxed">{quote.message}</p>}
            {view.paid > 0 && (
              <dl className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <Item label="Pagado">{money(view.paid)}</Item>
                <Item label={balance < 0 ? "A tu favor" : "Saldo"}>{money(Math.abs(balance))}</Item>
              </dl>
            )}
            {quote.status === "sent" && (
              <p className="text-sm text-fg-muted">
                {expired ? "Si todavía te interesa, escribime y lo actualizamos." : "Para aceptarlo o hacer preguntas, respondeme por mensaje."}
              </p>
            )}
          </Card>
        )}

        {!quote && view.paid > 0 && (
          <Card label="Pagos">
            <h2 className="font-medium">Pagos</h2>
            <p className="text-sm">
              Recibí <span className="tabular-nums">{money(view.paid)}</span>.
            </p>
          </Card>
        )}

        {appointments.length > 0 && (
          <Card label="Turnos">
            <h2 className="font-medium">Turnos</h2>
            <ul className="flex flex-col gap-4 text-sm">
              {appointments.map((appointment) => {
                const item = appointmentView(appointment, regional, now);
                const meta = APPOINTMENT_LABEL[appointment.status];
                return (
                  <li key={appointment.start.toISOString()} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="first-letter:uppercase">
                      {item.day}, {item.range}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
            {appointments.some((appointment) => appointment.status === "requested") && (
              <p className="text-sm text-fg-muted">Un turno &quot;a confirmar&quot; todavía no está reservado: te aviso cuando lo confirme.</p>
            )}
          </Card>
        )}

        <Card label="Tu idea">
          <h2 className="font-medium">Tu idea</h2>
          <p className="whitespace-pre-line leading-relaxed">{request.idea}</p>
          <dl className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
            <Item label="Zona">{request.bodyZone ?? "Sin indicar"}</Item>
            <Item label="Tamaño">{request.sizeLabel ?? "Sin indicar"}</Item>
          </dl>
        </Card>

        <footer className="flex flex-col gap-2 text-sm text-fg-subtle">
          {view.instagramHandle && (
            <p>
              ¿Dudas? Escribime por{" "}
              <a href={`https://www.instagram.com/${view.instagramHandle}/`} target="_blank" rel="noopener" className="text-fg-muted underline underline-offset-4 hover:text-fg">
                Instagram
              </a>{" "}
              o por donde venimos hablando.
            </p>
          )}
          <p>Este link es solo para vos: no lo compartas. Muestra el estado actual de tu consulta.</p>
        </footer>
      </main>
    </>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
      {children}
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-fg-subtle">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function InvalidLink() {
  return (
    <main id="contenido" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-24 sm:px-8">
      <h1 className="font-display text-4xl uppercase sm:text-5xl">Link no disponible</h1>
      <p className="leading-relaxed text-fg-muted">Este link no existe o ya no está activo. Pedile uno nuevo a quien te va a tatuar.</p>
    </main>
  );
}

function TrackingSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-8 lg:py-16">
      <Skeleton className="h-16 w-2/3" />
      <Skeleton className="h-32" />
      <Skeleton className="h-48" />
    </main>
  );
}
