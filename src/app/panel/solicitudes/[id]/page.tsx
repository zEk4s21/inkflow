import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelPageHeader } from "@/components/panel/page-header";
import { RequestStatusBadge } from "@/components/ui/badge";
import type { RequestStatus } from "@/config/request-status";
import { formatDateTime } from "@/lib/format";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getRequest, getWorkspaceRegional } from "@/server/requests/queries";

export const metadata: Metadata = { title: "Solicitud" };

export default async function RequestDetailPage({ params }: PageProps<"/panel/solicitudes/[id]">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const [request, regional] = await Promise.all([getRequest(workspace.id, id), getWorkspaceRegional(workspace.id)]);
  if (!request) notFound();
  const client = request.clients;
  const whatsapp = client.phone ? `https://wa.me/${client.phone}` : null;

  return (
    <>
      <Link href="/panel/solicitudes" className="text-sm text-fg-muted hover:text-fg">
        ← Solicitudes
      </Link>
      <PanelPageHeader
        title={client.name}
        description={`Recibida el ${formatDateTime(new Date(request.created_at), regional)} desde el formulario.`}
        actions={<RequestStatusBadge status={request.status as RequestStatus} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1/40 p-6">
          <h2 className="font-medium">La idea</h2>
          <p className="whitespace-pre-line leading-relaxed text-fg">{request.idea}</p>
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
        <section className="flex flex-col gap-4 self-start rounded-lg border border-line bg-surface-1/40 p-6">
          <h2 className="font-medium">Contacto</h2>
          <dl className="flex flex-col gap-3 text-sm">
            {client.email && (
              <div className="flex flex-col gap-1">
                <dt className="text-fg-subtle">Email</dt>
                <dd>
                  <a href={`mailto:${client.email}`} className="underline-offset-4 hover:underline">
                    {client.email}
                  </a>
                </dd>
              </div>
            )}
            {whatsapp && (
              <div className="flex flex-col gap-1">
                <dt className="text-fg-subtle">WhatsApp</dt>
                <dd>
                  <a href={whatsapp} target="_blank" rel="noopener" className="underline-offset-4 hover:underline">
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
    </>
  );
}
