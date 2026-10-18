import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelPageHeader } from "@/components/panel/page-header";
import { AppointmentActions } from "@/components/panel/appointments/appointment-actions";
import { NewAppointment } from "@/components/panel/appointments/new-appointment";
import { DeleteNoteButton } from "@/components/panel/requests/delete-note-button";
import { NoteForm } from "@/components/panel/requests/note-form";
import { StatusControl } from "@/components/panel/requests/status-control";
import { Badge, RequestStatusBadge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_META } from "@/config/appointment-status";
import {
  REQUEST_STATUS_META,
  type RequestStatus,
} from "@/config/request-status";
import { localDateOf } from "@/lib/availability";
import { formatDateTime } from "@/lib/format";
import { getRequestAppointments, getSlotMinutes } from "@/server/appointments/queries";
import { appointmentView } from "@/server/appointments/view";
import { requireWorkspace } from "@/server/auth/panel-context";
import {
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
  const [activity, names, appointments, slotMinutes] = await Promise.all([
    getRequestActivity(workspace.id, request.id),
    getMemberNames(workspace.id),
    getRequestAppointments(workspace.id, request.id),
    profile ? getSlotMinutes(profile.id) : null,
  ]);
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
            </dl>
          </section>

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
