import "server-only";
import type { AppointmentStatus } from "@/config/appointment-status";
import { parseTstzRange } from "@/server/availability/schemas";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type AppointmentSummary = {
  id: string;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  requestId: string | null;
  clientName: string;
};

type Row = { id: string; period: unknown; status: string; request_id: string | null; clients: { name: string } };

function toSummary(row: Row): AppointmentSummary[] {
  const period = parseTstzRange(row.period as string);
  if (!period) return [];
  return [{ id: row.id, ...period, status: row.status as AppointmentStatus, requestId: row.request_id, clientName: row.clients.name }];
}

/** Turnos ligados a una solicitud, del más reciente al más viejo. La RLS limita a los miembros. */
export async function getRequestAppointments(workspaceId: string, requestId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, period, status, request_id, clients!inner (name)")
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron leer los turnos: ${error.message}`);
  return data.flatMap(toSummary);
}

/** Pedidos de turno que todavía no pasaron, del más próximo al más lejano. */
export async function listUpcomingRequestedAppointments(workspaceId: string, artistId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, period, status, request_id, clients!inner (name)")
    .eq("workspace_id", workspaceId)
    .eq("artist_id", artistId)
    .eq("status", "requested")
    .filter("period", "ov", `[${new Date().toISOString()},infinity)`)
    .limit(50);
  if (error) throw new Error(`No se pudieron leer los turnos: ${error.message}`);
  return data.flatMap(toSummary).sort((a, b) => a.start.getTime() - b.start.getTime());
}
