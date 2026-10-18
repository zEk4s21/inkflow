import type { Metadata } from "next";
import { PanelPageHeader, PendingBadge } from "@/components/panel/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientsPage() {
  return (
    <>
      <PanelPageHeader
        title="Clientes"
        description="Las personas que te consultaron, con sus proyectos y turnos."
        actions={<PendingBadge phase="la Fase 2" />}
      />
      <EmptyState
        title="Todavía no hay clientes"
        description="Se van a crear solos a partir de cada solicitud, sin duplicados. Sus datos nunca se muestran en tu página pública."
      />
    </>
  );
}
