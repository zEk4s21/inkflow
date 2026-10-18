import type { Metadata } from "next";
import Link from "next/link";
import { PanelPageHeader } from "@/components/panel/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireWorkspace } from "@/server/auth/panel-context";
import { listClients } from "@/server/requests/queries";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const { workspace } = await requireWorkspace();
  const clients = await listClients(workspace.id);

  return (
    <>
      <PanelPageHeader
        title="Clientes"
        description="Se crean solos con cada consulta: el mismo email o WhatsApp es la misma persona. Si alguien escribió con datos distintos, unilos desde su ficha. Sus datos nunca se muestran en tu página pública."
      />
      {clients.length === 0 ? (
        <EmptyState title="Todavía no hay clientes" description="Cuando alguien te consulte desde tu página, aparece acá." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {clients.map((client) => {
            const requests = client.tattoo_requests[0]?.count ?? 0;
            return (
              <li key={client.id}>
                <Link
                  href={`/panel/clientes/${client.id}`}
                  className="flex flex-col gap-1 bg-surface-1/40 px-4 py-4 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{client.name}</span>
                    <span className="truncate text-sm text-fg-muted">
                      {[client.email, client.phone && `+${client.phone}`, client.instagram_handle && `@${client.instagram_handle}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className="text-xs text-fg-subtle">
                    {requests} {requests === 1 ? "solicitud" : "solicitudes"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
