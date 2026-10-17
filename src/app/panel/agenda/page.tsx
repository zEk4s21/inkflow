import type { Metadata } from "next";
import { PanelPageHeader, PendingBadge } from "@/components/panel/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <>
      <PanelPageHeader
        title="Agenda"
        description="Tus días de trabajo, bloqueos y turnos confirmados."
        actions={<PendingBadge phase="la Fase 3" />}
      />
      <EmptyState
        title="La agenda todavía no está activa"
        description="Vas a poder configurar tus horarios, bloquear fechas y aprobar pedidos de turno. Nada se reserva solo: cada turno lo confirmás vos."
      />
    </>
  );
}
