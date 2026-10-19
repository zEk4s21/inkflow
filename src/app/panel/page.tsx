import type { Metadata } from "next";
import Link from "next/link";
import { CopyLinkButton } from "@/components/panel/copy-link-button";
import { FollowUpList } from "@/components/panel/follow-ups/follow-up-list";
import { PanelPageHeader } from "@/components/panel/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestList } from "@/components/panel/request-list";
import { APPOINTMENT_STATUS_META } from "@/config/appointment-status";
import { localDateOf } from "@/lib/availability";
import { listOpenAppointments } from "@/server/appointments/queries";
import { appointmentView } from "@/server/appointments/view";
import { requireWorkspace } from "@/server/auth/panel-context";
import { listPendingFollowUps } from "@/server/follow-ups/queries";
import { addDays } from "@/server/follow-ups/schemas";
import { getWorkspaceRegional, listRequests } from "@/server/requests/queries";
import { getPublishedWorks } from "@/server/artists/public-artist";

export const metadata: Metadata = { title: "Inicio" };

export default async function PanelHome() {
  const { workspace, profile, role } = await requireWorkspace();
  const regional = await getWorkspaceRegional(workspace.id);
  const now = new Date();
  const today = localDateOf(now, regional.timeZone);
  const [works, newRequests, appointments, followUps] = await Promise.all([
    getPublishedWorks(workspace.slug),
    listRequests(workspace.id, { status: "new", limit: 5 }),
    profile ? listOpenAppointments(workspace.id, profile.id) : [],
    // Vencidos, de hoy y de la próxima semana.
    listPendingFollowUps(workspace.id, addDays(today, 7)),
  ]);
  const upcoming = appointments.filter((appointment) => appointment.end > now).slice(0, 5);

  return (
    <>
      <PanelPageHeader title="Inicio" description="Lo que necesita tu atención hoy." />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="nuevas" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="nuevas" className="text-sm font-medium text-fg-muted">
              Solicitudes nuevas
            </h2>
            {newRequests.length > 0 && (
              <Link href="/panel/solicitudes" className="text-sm text-fg-muted hover:text-fg">
                Ver todas
              </Link>
            )}
          </div>
          {newRequests.length === 0 ? (
            <EmptyState
              title="No hay solicitudes nuevas"
              description="Cuando alguien te consulte desde tu página, la vas a ver acá. Compartí tu link en la bio de Instagram."
              action={<CopyLinkButton path={`/artist/${workspace.slug}`} />}
            />
          ) : (
            <RequestList requests={newRequests} regional={regional} />
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="turnos" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="turnos" className="text-sm font-medium text-fg-muted">
                Próximos turnos
              </h2>
              <Link href="/panel/agenda" className="text-sm text-fg-muted hover:text-fg">
                Ver agenda
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="rounded-lg border border-line bg-surface-1 p-6 text-sm text-fg-muted">No hay turnos pedidos ni confirmados.</div>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface-1 px-5 text-sm">
                {upcoming.map((appointment) => {
                  const view = appointmentView(appointment, regional, now);
                  const meta = APPOINTMENT_STATUS_META[appointment.status];
                  return (
                    <li key={appointment.id} className="flex items-center justify-between gap-3 py-4">
                      <span className="flex flex-col gap-1">
                        {appointment.requestId ? (
                          <Link href={`/panel/solicitudes/${appointment.requestId}`} className="font-medium underline-offset-4 hover:underline">
                            {appointment.clientName}
                          </Link>
                        ) : (
                          <span className="font-medium">{appointment.clientName}</span>
                        )}
                        <span className="text-xs text-fg-subtle first-letter:uppercase">
                          {view.day}, {view.range}
                        </span>
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="controles" className="flex flex-col gap-4">
            <h2 id="controles" className="text-sm font-medium text-fg-muted">
              Controles de la semana
            </h2>
            {followUps.length === 0 ? (
              <div className="rounded-lg border border-line bg-surface-1 p-6 text-sm text-fg-muted">
                No hay controles pendientes. Se agendan solos cuando marcás un turno como realizado.
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-surface-1 p-5">
                <FollowUpList items={followUps} today={today} regional={regional} canEdit={role === "owner" || role === "artist"} withClient />
              </div>
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="accesos" className="flex flex-col gap-4">
        <h2 id="accesos" className="text-sm font-medium text-fg-muted">
          Accesos rápidos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink href="/panel/portfolio" title="Portfolio" detail={`${works.length} trabajos publicados`} />
          <QuickLink href={`/artist/${workspace.slug}`} title="Mi página pública" detail={`/artist/${workspace.slug}`} />
          <QuickLink href="/panel/ajustes" title="Ajustes" detail="Perfil, horarios y región" />
        </div>
      </section>
    </>
  );
}

function QuickLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg border border-line bg-surface-1 p-5 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex flex-col gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-fg-subtle">{detail}</span>
      </span>
      <span aria-hidden className="text-fg-subtle transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
