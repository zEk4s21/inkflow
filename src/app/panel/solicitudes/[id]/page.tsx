import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelPageHeader } from "@/components/panel/page-header";
import { AppointmentActions } from "@/components/panel/appointments/appointment-actions";
import { NewAppointment } from "@/components/panel/appointments/new-appointment";
import { ClientLink } from "@/components/panel/requests/client-link";
import { DeleteNoteButton } from "@/components/panel/requests/delete-note-button";
import { NoteForm } from "@/components/panel/requests/note-form";
import { StatusControl } from "@/components/panel/requests/status-control";
import { FollowUpList } from "@/components/panel/follow-ups/follow-up-list";
import { NewFollowUp } from "@/components/panel/follow-ups/new-follow-up";
import { NewPayment } from "@/components/panel/payments/new-payment";
import { PaymentList } from "@/components/panel/payments/payment-list";
import { NewQuote } from "@/components/panel/quotes/new-quote";
import { QuoteActions } from "@/components/panel/quotes/quote-actions";
import { QuoteDetails } from "@/components/panel/quotes/quote-details";
import { Badge, RequestStatusBadge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_META } from "@/config/appointment-status";
import {
  REQUEST_STATUS_META,
  type RequestStatus,
} from "@/config/request-status";
import { localDateOf } from "@/lib/availability";
import { COLOR_LABELS } from "@/server/assistant/brief";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getRequestAppointments, getSlotMinutes } from "@/server/appointments/queries";
import { appointmentView } from "@/server/appointments/view";
import { getRequestFollowUps } from "@/server/follow-ups/queries";
import { addDays } from "@/server/follow-ups/schemas";
import { getPaymentsForRequests } from "@/server/payments/queries";
import { paymentTotals, referenceQuote } from "@/server/payments/schemas";
import { getRequestQuotes } from "@/server/quotes/queries";
import { requireWorkspace } from "@/server/auth/panel-context";
import {
  getConversationMessages,
  getMemberNames,
  getRequest,
  getRequestActivity,
  getWorkspaceRegional,
} from "@/server/requests/queries";

const SOURCE_LABEL: Record<string, string> = {
  form: "desde el formulario",
  assistant: "desde el asistente",
  manual: "cargada a mano",
};

export const metadata: Metadata = { title: "Solicitud" };

export default async function RequestDetailPage({
  params,
}: PageProps<"/panel/solicitudes/[id]">) {
  const { id } = await params;
  const { workspace, role, userId, profile } = await requireWorkspace();
  const [request, regional] = await Promise.all([
    getRequest(workspace.id, id),
    getWorkspaceRegional(workspace.id),
  ]);
  if (!request) notFound();
  const [activity, names, appointments, slotMinutes, conversation, quotes, payments, followUps] = await Promise.all([
    getRequestActivity(workspace.id, request.id),
    getMemberNames(workspace.id),
    getRequestAppointments(workspace.id, request.id),
    profile ? getSlotMinutes(profile.id) : null,
    request.conversation_id ? getConversationMessages(request.conversation_id) : null,
    getRequestQuotes(workspace.id, request.id),
    getPaymentsForRequests(workspace.id, [request.id]),
    getRequestFollowUps(workspace.id, request.id),
  ]);
  const baseQuote = referenceQuote(quotes);
  const totals = paymentTotals(payments, baseQuote?.amount ?? null);
  const money = (amount: number) => formatMoney(amount, regional);
  // Uno abierto (borrador o enviado) a la vez: lo garantiza un índice único en la base.
  const hasOpenQuote = quotes.some((quote) => quote.status === "draft" || quote.status === "sent");
  // Datos que suma el asistente: solo se muestran los que vinieron.
  const extras = [
    ["Estilo", request.style],
    ["Color", request.color_mode ? COLOR_LABELS[request.color_mode as keyof typeof COLOR_LABELS] : null],
    ["Cubre otro tatuaje", request.is_cover_up === null ? null : request.is_cover_up ? "Sí" : "No"],
  ].filter((entry): entry is [string, string] => entry[1] !== null);
  const canEdit = role === "owner" || role === "artist";
  const now = new Date();
  const today = localDateOf(now, regional.timeZone);
  // Propuesta para "Dar turno": pasado mañana a las 11, con la duración de turno del horario semanal.
  const newAppointmentDefaults = {
    date: localDateOf(new Date(now.getTime() + 2 * 86_400_000), regional.timeZone),
    time: "11:00",
    durationMinutes: slotMinutes ?? 180,
  };
  const status = request.status as RequestStatus;
  const who = (id: string | null) =>
    id === userId ? "Vos" : (id && names.get(id)) || "Alguien del estudio";
  const client = request.clients;
  const whatsapp = client.phone ? `https://wa.me/${client.phone}` : null;

  return (
    <>
      <Link
        href="/panel/solicitudes"
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Solicitudes
      </Link>
      <PanelPageHeader
        title={client.name}
        description={`Recibida el ${formatDateTime(new Date(request.created_at), regional)} ${SOURCE_LABEL[request.source] ?? ""}.`}
        actions={<RequestStatusBadge status={status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
            <h2 className="font-medium">La idea</h2>
            <p className="whitespace-pre-line leading-relaxed text-fg">
              {request.idea}
            </p>
            <dl className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-fg-subtle">Zona</dt>
                <dd>{request.body_zone ?? "Sin indicar"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-fg-subtle">Tamaño</dt>
                <dd>{request.size_label ?? "Sin indicar"}</dd>
              </div>
              {extras.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-fg-subtle">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {request.details && (
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <dt className="text-fg-subtle">Otros detalles</dt>
                  <dd className="whitespace-pre-line">{request.details}</dd>
                </div>
              )}
            </dl>
          </section>

          {conversation && conversation.length > 0 && (
            <section aria-label="Conversación con el asistente" className="rounded-lg border border-line bg-surface-1/40 p-6">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                  Conversación con el asistente
                  <span className="text-sm font-normal text-fg-subtle group-open:hidden">Ver ({conversation.length} mensajes)</span>
                </summary>
                <ol className="mt-4 flex flex-col gap-3 text-sm">
                  {conversation.map((message) => (
                    <li
                      key={message.id}
                      className={
                        message.role === "user"
                          ? "max-w-[85%] self-end rounded-2xl bg-accent/15 px-4 py-3 whitespace-pre-wrap"
                          : "max-w-[85%] self-start rounded-2xl bg-surface-2 px-4 py-3 whitespace-pre-wrap text-fg-muted"
                      }
                    >
                      <span className="sr-only">{message.role === "user" ? "Cliente: " : "Asistente: "}</span>
                      {message.content}
                    </li>
                  ))}
                </ol>
              </details>
            </section>
          )}

          <section className="flex flex-col gap-5 rounded-lg border border-line bg-surface-1/40 p-6">
            <h2 className="font-medium">Seguimiento</h2>
            <ol className="flex flex-col gap-4 border-l border-line pl-5 text-sm">
              <li className="flex flex-col gap-1">
                <span className="text-fg">Llegó la consulta</span>
                <time
                  dateTime={request.created_at}
                  className="text-xs text-fg-subtle"
                >
                  {formatDateTime(new Date(request.created_at), regional)}
                </time>
              </li>
              {activity.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex flex-col gap-1"
                >
                  {item.kind === "status" ? (
                    <span className="text-fg">
                      {who(item.by)} pasó de{" "}
                      {REQUEST_STATUS_META[item.from]?.label ?? item.from} a{" "}
                      <strong className="font-medium">
                        {REQUEST_STATUS_META[item.to]?.label ?? item.to}
                      </strong>
                    </span>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2/60 p-3">
                      <p className="whitespace-pre-line text-fg">{item.body}</p>
                      <span className="text-xs text-fg-subtle">
                        Nota de {who(item.by)}
                      </span>
                    </div>
                  )}
                  <span className="flex items-center justify-between gap-3">
                    <time
                      dateTime={item.at.toISOString()}
                      className="text-xs text-fg-subtle"
                    >
                      {formatDateTime(item.at, regional)}
                    </time>
                    {item.kind === "note" && canEdit && item.by === userId && (
                      <DeleteNoteButton noteId={item.id} />
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {canEdit ? (
              <NoteForm requestId={request.id} />
            ) : (
              <p className="text-sm text-fg-muted">
                Tu rol puede ver el seguimiento, pero no cambiar estados ni
                agregar notas.
              </p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 self-start">
          {canEdit && (
            <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
              <h2 className="font-medium">Estado</h2>
              <StatusControl
                key={status}
                requestId={request.id}
                status={status}
              />
            </section>
          )}
          {(quotes.length > 0 || canEdit) && (
            <section aria-label="Presupuesto" className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
              <h2 className="font-medium">Presupuesto</h2>
              {quotes.length === 0 && <p className="text-sm text-fg-muted">Todavía no tiene presupuesto.</p>}
              <ul className="flex flex-col gap-5 divide-y divide-line text-sm">
                {quotes.map((quote) => (
                  <li key={quote.id} className="flex flex-col gap-3 pt-5 first:pt-0">
                    <QuoteDetails quote={quote} regional={regional} />
                    {canEdit && (
                      <QuoteActions
                        quoteId={quote.id}
                        status={quote.status}
                        today={today}
                        currency={quote.currency}
                        current={{
                          amount: String(quote.amount),
                          deposit: quote.deposit === null ? "" : String(quote.deposit),
                          estimatedSessions: quote.estimatedSessions === null ? "" : String(quote.estimatedSessions),
                          validUntil: quote.validUntil ?? "",
                          message: quote.message ?? "",
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && !hasOpenQuote && <NewQuote requestId={request.id} today={today} currency={regional.currency} />}
              {canEdit && (
                <p className="text-xs text-fg-subtle">
                  INKFLOW no le avisa al cliente: pasáselo por mensaje y marcalo como enviado. Con el link para el cliente lo puede ver.
                </p>
              )}
            </section>
          )}
          {(payments.length > 0 || canEdit) && (
            <section aria-label="Pagos" className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
              <h2 className="font-medium">Pagos</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <dt className="text-fg-subtle">Cobrado</dt>
                  <dd className="font-serif text-2xl tabular-nums">{money(totals.paid)}</dd>
                </div>
                {totals.balance !== null && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-fg-subtle">{totals.balance < 0 ? "Cobrado de más" : "Saldo"}</dt>
                    <dd className="font-serif text-2xl tabular-nums">{money(Math.abs(totals.balance))}</dd>
                  </div>
                )}
              </dl>
              {baseQuote ? (
                <p className="text-xs text-fg-subtle">
                  Contra el presupuesto {baseQuote.status === "accepted" ? "aceptado" : "enviado"} de {money(baseQuote.amount)}.
                </p>
              ) : (
                <p className="text-xs text-fg-subtle">El saldo aparece cuando hay un presupuesto enviado o aceptado.</p>
              )}
              {payments.length > 0 && <PaymentList payments={payments} regional={regional} canEdit={canEdit} />}
              {canEdit && (
                <>
                  <NewPayment requestId={request.id} today={today} currency={regional.currency} firstPayment={totals.paid === 0} />
                  <p className="text-xs text-fg-subtle">INKFLOW no cobra: anotá acá lo que recibiste por otro medio.</p>
                </>
              )}
            </section>
          )}
          {(appointments.length > 0 || canEdit) && (
            <section aria-label="Turnos" className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
              <h2 className="font-medium">Turnos</h2>
              {appointments.length === 0 && <p className="text-sm text-fg-muted">Todavía no tiene turno.</p>}
              <ul className="flex flex-col gap-5 text-sm">
                {appointments.map((appointment) => {
                  const meta = APPOINTMENT_STATUS_META[appointment.status];
                  const view = appointmentView(appointment, regional, now);
                  return (
                    <li key={appointment.id} className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="first-letter:uppercase">
                          {view.day}, {view.range}
                        </span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      {appointment.status === "requested" && (
                        <p className="text-fg-muted">Lo pidió desde tu página y todavía no está reservado.</p>
                      )}
                      {canEdit && (
                        <AppointmentActions
                          appointmentId={appointment.id}
                          status={appointment.status}
                          started={view.started}
                          label={view.label}
                          current={view.current}
                          today={today}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
              {canEdit && (
                <>
                  <NewAppointment requestId={request.id} initial={newAppointmentDefaults} today={today} />
                  <p className="text-xs text-fg-subtle">
                    Los cambios no le llegan al cliente: avisale por mensaje. Los avisos automáticos llegan más adelante.
                  </p>
                </>
              )}
            </section>
          )}
          {(followUps.length > 0 || canEdit) && (
            <section aria-label="Controles" className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
              <h2 className="font-medium">Controles</h2>
              {followUps.length === 0 ? (
                <p className="text-sm text-fg-muted">Al marcar un turno como realizado se agendan dos: a los 7 días (cicatrización) y a los 30 (retoque).</p>
              ) : (
                <FollowUpList items={followUps} today={today} regional={regional} canEdit={canEdit} />
              )}
              {canEdit && <NewFollowUp requestId={request.id} defaultDate={addDays(today, 7)} />}
            </section>
          )}
          {canEdit && (
            <section aria-label="Link para el cliente" className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
              <h2 className="font-medium">Link para el cliente</h2>
              <ClientLink
                requestId={request.id}
                phone={client.phone}
                activeSince={request.public_token_created_at ? formatDateTime(new Date(request.public_token_created_at), regional) : null}
              />
            </section>
          )}
          <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Contacto</h2>
              <Link href={`/panel/clientes/${client.id}`} className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                Ver ficha
              </Link>
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              {client.email && (
                <div className="flex flex-col gap-1">
                  <dt className="text-fg-subtle">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${client.email}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {client.email}
                    </a>
                  </dd>
                </div>
              )}
              {whatsapp && (
                <div className="flex flex-col gap-1">
                  <dt className="text-fg-subtle">WhatsApp</dt>
                  <dd>
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener"
                      className="underline-offset-4 hover:underline"
                    >
                      +{client.phone}
                    </a>
                  </dd>
                </div>
              )}
              {client.instagram_handle && (
                <div className="flex flex-col gap-1">
                  <dt className="text-fg-subtle">Instagram</dt>
                  <dd>
                    <a
                      href={`https://www.instagram.com/${client.instagram_handle}/`}
                      target="_blank"
                      rel="noopener"
                      className="underline-offset-4 hover:underline"
                    >
                      @{client.instagram_handle}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
