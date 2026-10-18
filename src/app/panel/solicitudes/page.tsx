import type { Metadata } from "next";
import Link from "next/link";
import { CopyLinkButton } from "@/components/panel/copy-link-button";
import { PanelPageHeader } from "@/components/panel/page-header";
import { RequestList } from "@/components/panel/request-list";
import { EmptyState } from "@/components/ui/empty-state";
import { REQUEST_STATUS_META, REQUEST_STATUSES, type RequestStatus } from "@/config/request-status";
import { cn } from "@/lib/cn";
import { requireWorkspace } from "@/server/auth/panel-context";
import { countRequestsByStatus, getWorkspaceRegional, listRequests } from "@/server/requests/queries";

export const metadata: Metadata = { title: "Solicitudes" };

function parseStatus(value: string | string[] | undefined): RequestStatus | undefined {
  return REQUEST_STATUSES.find((status) => status === value);
}

export default async function RequestsPage({ searchParams }: PageProps<"/panel/solicitudes">) {
  const status = parseStatus((await searchParams).estado);
  const { workspace } = await requireWorkspace();
  const [requests, counts, regional] = await Promise.all([
    listRequests(workspace.id, { status }),
    countRequestsByStatus(workspace.id),
    getWorkspaceRegional(workspace.id),
  ]);

  const filters = [
    { href: "/panel/solicitudes", label: "Todas", count: counts.total, active: !status },
    ...REQUEST_STATUSES.filter((option) => counts.byStatus.has(option) || option === status).map((option) => ({
      href: `/panel/solicitudes?estado=${option}`,
      label: REQUEST_STATUS_META[option].label,
      count: counts.byStatus.get(option) ?? 0,
      active: option === status,
    })),
  ];

  return (
    <>
      <PanelPageHeader
        title="Solicitudes"
        description="Las consultas que llegan desde el formulario de tu página. Entrá a cada una para cambiar el estado y dejar notas."
      />
      {counts.total === 0 ? (
        <EmptyState
          title="Sin solicitudes por ahora"
          description="Cuando alguien complete el formulario de tu página, la consulta aparece acá."
          action={<CopyLinkButton path={`/artist/${workspace.slug}`} />}
        />
      ) : (
        <>
          <nav aria-label="Filtrar por estado" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {filters.map((filter) => (
              <Link
                key={filter.href}
                href={filter.href}
                aria-current={filter.active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                  filter.active ? "border-fg bg-fg text-ink" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                )}
              >
                {filter.label}
                <span className={cn("text-xs", filter.active ? "text-ink/70" : "text-fg-subtle")}>{filter.count}</span>
              </Link>
            ))}
          </nav>
          {requests.length === 0 ? (
            <EmptyState title="No hay solicitudes en este estado" description="Probá con otro filtro." />
          ) : (
            <RequestList requests={requests} regional={regional} />
          )}
        </>
      )}
    </>
  );
}
