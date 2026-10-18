import type { Metadata } from "next";
import { CopyLinkButton } from "@/components/panel/copy-link-button";
import { PanelPageHeader } from "@/components/panel/page-header";
import { RequestList } from "@/components/panel/request-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getWorkspaceRegional, listRequests } from "@/server/requests/queries";

export const metadata: Metadata = { title: "Solicitudes" };

export default async function RequestsPage() {
  const { workspace } = await requireWorkspace();
  const [requests, regional] = await Promise.all([listRequests(workspace.id), getWorkspaceRegional(workspace.id)]);

  return (
    <>
      <PanelPageHeader
        title="Solicitudes"
        description="Las consultas que llegan desde el formulario de tu página. Cambiar estados y agregar notas llega en la Fase 2.6."
      />
      {requests.length === 0 ? (
        <EmptyState
          title="Sin solicitudes por ahora"
          description="Cuando alguien complete el formulario de tu página, la consulta aparece acá."
          action={<CopyLinkButton path={`/artist/${workspace.slug}`} />}
        />
      ) : (
        <RequestList requests={requests} regional={regional} />
      )}
    </>
  );
}
