import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ClientForm } from "@/components/panel/clients/client-form";
import { MergeClient } from "@/components/panel/clients/merge-client";
import { PanelPageHeader } from "@/components/panel/page-header";
import { RequestList } from "@/components/panel/request-list";
import { PaymentList } from "@/components/panel/payments/payment-list";
import { QuoteDetails } from "@/components/panel/quotes/quote-details";
import { formatDateTime, formatMoney } from "@/lib/format";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getPaymentsForRequests } from "@/server/payments/queries";
import { paymentTotals } from "@/server/payments/schemas";
import { getQuotesForRequests } from "@/server/quotes/queries";
import { getClient, getWorkspaceRegional, listClients } from "@/server/requests/queries";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientDetailPage({ params }: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  const { workspace, role } = await requireWorkspace();
  const [client, regional] = await Promise.all([getClient(workspace.id, id), getWorkspaceRegional(workspace.id)]);
  if (!client) notFound();
  const canEdit = role === "owner" || role === "artist";
  const requestIds = client.requests.map((request) => request.id);
  const [quotes, payments] = await Promise.all([
    getQuotesForRequests(workspace.id, requestIds),
    getPaymentsForRequests(workspace.id, requestIds),
  ]);
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
          {payments.length > 0 && (
            <Card title="Pagos">
              <p className="text-sm text-fg-muted">
                Cobrado en total: <span className="font-medium text-fg tabular-nums">{formatMoney(paymentTotals(payments, null).paid, regional)}</span>
              </p>
              {/* Para anular, desde la solicitud: acá es solo la vista general del cliente. */}
              <PaymentList payments={payments} regional={regional} canEdit={false} />
            </Card>
          )}
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
