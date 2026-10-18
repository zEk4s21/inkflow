import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BlockForm } from "@/components/panel/agenda/block-form";
import { AppointmentActions } from "@/components/panel/appointments/appointment-actions";
import { DeleteBlockButton } from "@/components/panel/agenda/delete-block-button";
import { WeeklyEditor } from "@/components/panel/agenda/weekly-editor";
import { PanelPageHeader } from "@/components/panel/page-header";
import type { RegionalSettings } from "@/config/regional";
import { computeSlots, localDateOf, WEEKDAY_LABELS, type TimeRange } from "@/lib/availability";
import { formatDateTime } from "@/lib/format";
import { getConfirmedBusy, listOpenAppointments, type AppointmentSummary } from "@/server/appointments/queries";
import { appointmentView } from "@/server/appointments/view";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getAvailability } from "@/server/availability/queries";
import { MIN_NOTICE_MINUTES } from "@/server/availability/schemas";
import { getWorkspaceRegional } from "@/server/requests/queries";

export const metadata: Metadata = { title: "Agenda" };

const PREVIEW_DAYS = 14;

export default async function AgendaPage() {
  const { workspace, profile, role } = await requireWorkspace();
  const canEdit = role === "owner" || role === "artist";

  if (!profile) {
    return (
      <>
        <PanelPageHeader title="Agenda" description="Tus días de trabajo, bloqueos y turnos." />
        <Card title="Falta el perfil de artista">
          <p className="text-sm text-fg-muted">La agenda se arma sobre un perfil de artista y este estudio todavía no tiene uno.</p>
        </Card>
      </>
    );
  }

  const [{ rules, blocks }, regional, open, confirmedBusy] = await Promise.all([
    getAvailability(profile.id),
    getWorkspaceRegional(workspace.id),
    listOpenAppointments(workspace.id, profile.id),
    getConfirmedBusy(profile.id),
  ]);
  const now = new Date();
  const today = localDateOf(now, regional.timeZone);
  const requested = open.filter((appointment) => appointment.status === "requested");
  const confirmed = open.filter((appointment) => appointment.status === "confirmed");
  const slots = computeSlots({
    rules,
    busy: [...blocks, ...confirmedBusy],
    timeZone: regional.timeZone,
    from: now,
    days: PREVIEW_DAYS,
    minNoticeMinutes: MIN_NOTICE_MINUTES,
  });
  const slotsByDay = Map.groupBy(slots, (slot) => localDateOf(slot.start, regional.timeZone));

  return (
    <>
      <PanelPageHeader
        title="Agenda"
        description="Tus días y horarios de trabajo y las fechas que no atendés. Con esto se calculan los turnos que ofrece tu página."
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Horario semanal" description={`Horas en la zona horaria del estudio (${regional.timeZone}).`}>
          {canEdit ? (
            <WeeklyEditor rules={rules} />
          ) : rules.length === 0 ? (
            <p className="text-sm text-fg-muted">Todavía no hay horarios cargados.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {rules.map((rule) => (
                <li key={`${rule.weekday}-${rule.start}`}>
                  {WEEKDAY_LABELS[rule.weekday]}: {rule.start} a {rule.end}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Bloqueos" description="Vacaciones, feriados o cualquier momento en que no atendés.">
            {blocks.length === 0 ? (
              <p className="text-sm text-fg-muted">No hay bloqueos cargados.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line text-sm">
                {blocks.map((block) => {
                  const label = blockLabel(block, regional);
                  return (
                    <li key={block.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span>{label}</span>
                        {block.reason && <span className="truncate text-xs text-fg-subtle">{block.reason}</span>}
                      </div>
                      {canEdit && <DeleteBlockButton blockId={block.id} label={label} />}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit && <BlockForm today={today} />}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Turnos pedidos" description="Pedidos desde tu página. No ocupan el horario hasta que los confirmás.">
          <AppointmentList appointments={requested} empty="No hay pedidos de turno pendientes." canEdit={canEdit} regional={regional} today={today} now={now} />
        </Card>
        <Card title="Turnos confirmados" description="Los próximos, y los que ya pasaron y falta marcar como realizados.">
          <AppointmentList appointments={confirmed} empty="No hay turnos confirmados." canEdit={canEdit} regional={regional} today={today} now={now} />
        </Card>
      </div>

      <Card
        title="Turnos libres en las próximas dos semanas"
        description={`Así quedan con tu horario, tus bloqueos y los turnos confirmados. Se ofrecen con al menos ${MIN_NOTICE_MINUTES / 60} horas de anticipación.`}
      >
        {slots.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {rules.length === 0 ? "Cargá tu horario semanal para ver los turnos." : "No quedan turnos libres en estas dos semanas."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...slotsByDay].map(([day, daySlots]) => (
              <li key={day} className="flex flex-col gap-2 rounded-lg border border-line p-4">
                <span className="text-sm font-medium first-letter:uppercase">
                  {formatDateTime(daySlots[0].start, regional, { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <span className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <span key={slot.start.toISOString()} className="rounded-full border border-line px-3 py-1 text-sm text-fg-muted">
                      {formatDateTime(slot.start, regional, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AppointmentList({
  appointments,
  empty,
  canEdit,
  regional,
  today,
  now,
}: {
  appointments: AppointmentSummary[];
  empty: string;
  canEdit: boolean;
  regional: RegionalSettings;
  today: string;
  now: Date;
}) {
  if (appointments.length === 0) return <p className="text-sm text-fg-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line rounded-lg border border-line text-sm">
      {appointments.map((appointment) => {
        const view = appointmentView(appointment, regional, now);
        return (
          <li key={appointment.id} className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="first-letter:uppercase">
                  {view.day}, {view.range}
                </span>
                <span className="text-xs text-fg-subtle">{appointment.clientName}</span>
              </span>
              {appointment.requestId && (
                <Link href={`/panel/solicitudes/${appointment.requestId}`} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                  Ver solicitud
                </Link>
              )}
            </div>
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
  );
}

/** "20 dic. 2026 – 3 ene. 2027" para días completos; con horas si el bloqueo es parcial. */
function blockLabel(block: TimeRange, regional: RegionalSettings) {
  const time = (date: Date) => formatDateTime(date, regional, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const allDay = time(block.start) === "00:00" && time(block.end) === "00:00";
  if (!allDay) return `${formatDateTime(block.start, regional)} – ${formatDateTime(block.end, regional)}`;
  // El fin es exclusivo (00:00 del día siguiente): se muestra el último día bloqueado.
  const lastDay = new Date(block.end.getTime() - 1);
  const first = formatDateTime(block.start, regional, { dateStyle: "medium" });
  const last = formatDateTime(lastDay, regional, { dateStyle: "medium" });
  return first === last ? first : `${first} – ${last}`;
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-5 rounded-lg border border-line bg-surface-1/40 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
