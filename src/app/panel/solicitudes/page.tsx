import type { Metadata } from "next";
import { PanelPageHeader, PendingBadge } from "@/components/panel/page-header";
import { RequestStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { REQUEST_STATUSES } from "@/config/request-status";

export const metadata: Metadata = { title: "Solicitudes" };

export default function RequestsPage() {
  return (
    <>
      <PanelPageHeader
        title="Solicitudes"
        description="Cada consulta se convierte en un proyecto que avanza por estos estados."
        actions={<PendingBadge phase="la Fase 2" />}
      />
      <div className="flex flex-wrap gap-2" aria-label="Estados posibles">
        {REQUEST_STATUSES.map((status) => (
          <RequestStatusBadge key={status} status={status} />
        ))}
      </div>
      <EmptyState
        title="Sin solicitudes por ahora"
        description="Cuando el formulario de tu página esté activo, cada consulta va a aparecer acá con sus datos, referencias, notas privadas e historial."
      />
    </>
  );
}
