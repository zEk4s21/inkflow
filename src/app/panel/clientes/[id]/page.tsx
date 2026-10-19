import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ClientForm } from "@/components/panel/clients/client-form";
import { MergeClient } from "@/components/panel/clients/merge-client";
import { PanelPageHeader } from "@/components/panel/page-header";
import { RequestList } from "@/components/panel/request-list";
import { QuoteDetails } from "@/components/panel/quotes/quote-details";
import { formatDateTime } from "@/lib/format";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getQuotesForRequests } from "@/server/quotes/queries";
import { getClient, getWorkspaceRegional, listClients } from "@/server/requests/queries";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientDetailPage({ params }: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  const { workspace, role } = await requireWorkspace();
  const [client, regional] = await Promise.all([getClient(workspace.id, id), getWorkspaceRegional(workspace.id)]);
  if (!client) notFound();
  const canEdit = role === "owner" || role === "artist";
  const quotes = await getQuotesForRequests(
    workspace.id,
    client.requests.map((request) => request.id),
  );
  const others = canEdit ? (await listClients(workspace.id)).filter((other) => other.id !== client.id) : [];

  return (
    <>
      <Link href="/panel/clientes" className="text-sm text-fg-muted hover:text-fg">
        ← Clientes
      </Link>
      <PanelPageHeader title={client.name} description={`Cliente desde el ${formatDateTime(new Date(client.created_at), regional)}`} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title={`Solicitudes (${client.requests.length})`}>
          {client.requests.length === 0 ? (
            <p className="text-sm text-fg-muted">Este cliente no tiene solicitudes.</p>
          ) : (
            <RequestList requests={client.requests} regional={regional} />
          )}
        </Card>

        <div className="flex flex-col gap-6 self-start">
          {quotes.length > 0 && (
            <Card title={`Presupuestos (${quotes.length})`}>
              <ul className="flex flex-col gap-5 divide-y divide-line text-sm">
                {quotes.map((quote) => (
                  <li key={quote.id} className="flex flex-col gap-3 pt-5 first:pt-0">
                    <QuoteDetails quote={quote} regional={regional} />
                    <Link href={`/panel/solicitudes/${quote.requestId}`} className="self-start text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                      Ver solicitud
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Datos de contacto">
            {canEdit ? (
              <ClientForm
                clientId={client.id}
                initial={{
                  name: client.name,
                  email: client.email ?? "",
                  phone: client.phone ?? "",
                  instagramHandle: client.instagram_handle ?? "",
                }}
              />
            ) : (
              <dl className="flex flex-col gap-3 text-sm">
                {[
                  ["Email", client.email],
                  ["WhatsApp", client.phone && `+${client.phone}`],
                  ["Instagram", client.instagram_handle && `@${client.instagram_handle}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <dt className="text-fg-subtle">{label}</dt>
                    <dd>{value || "Sin dato"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {canEdit && others.length > 0 && (
            <Card title="Unir con otro cliente">
              <MergeClient
                clientId={client.id}
                clientName={client.name}
                options={others.map((other) => ({
                  id: other.id,
                  label: [other.name, other.email ?? (other.phone && `+${other.phone}`)].filter(Boolean).join(" · "),
                }))}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-5 rounded-lg border border-line bg-surface-1/40 p-6">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}
