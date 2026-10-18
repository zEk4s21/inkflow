import "server-only";
import type { AppointmentStatus } from "@/config/appointment-status";
import { parseTstzRange } from "@/server/availability/schemas";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type AppointmentSummary = {
  id: string;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  source: string;
  requestId: string | null;
  clientName: string;
};

type Row = { id: string; period: unknown; status: string; source: string; request_id: string | null; clients: { name: string } };

const COLUMNS = "id, period, status, source, request_id, clients!inner (name)";

function toSummary(row: Row): AppointmentSummary[] {
  const period = parseTstzRange(row.period as string);
  if (!period) return [];
  return [
    { id: row.id, ...period, status: row.status as AppointmentStatus, source: row.source, requestId: row.request_id, clientName: row.clients.name },
  ];
}

/** Turnos ligados a una solicitud, del más reciente al más viejo. La RLS limita a los miembros. */
export async function getRequestAppointments(workspaceId: string, requestId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron leer los turnos: ${error.message}`);
  return data.flatMap(toSummary);
}

/**
 * Turnos abiertos (pedidos o confirmados) del tatuador, del más próximo al más lejano. Incluye
 * los confirmados que ya pasaron y nadie cerró, para marcarlos como realizados o ausentes.
 */
export async function listOpenAppointments(workspaceId: string, artistId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("artist_id", artistId)
    .in("status", ["requested", "confirmed"])
    .limit(200);
  if (error) throw new Error(`No se pudieron leer los turnos: ${error.message}`);
  const now = Date.now();
  // Los pedidos que ya pasaron sin respuesta no se pueden confirmar: no se muestran.
  return data
    .flatMap(toSummary)
    .filter((appointment) => appointment.status === "confirmed" || appointment.start.getTime() > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Períodos ocupados por turnos confirmados (con su margen), para calcular los turnos libres. */
export async function getConfirmedBusy(artistId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("blocked_period")
    .eq("artist_id", artistId)
    .eq("status", "confirmed")
    .filter("blocked_period", "ov", `[${new Date().toISOString()},infinity)`);
  if (error) throw new Error(`No se pudieron leer los turnos: ${error.message}`);
  return data.flatMap((row) => parseTstzRange(row.blocked_period as string) ?? []);
}

/** Duración de turno del horario semanal (es la misma todos los días), o null si no hay horario. */
export async function getSlotMinutes(artistId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("availability_rules").select("slot_minutes").eq("artist_id", artistId).limit(1).maybeSingle();
  return data?.slot_minutes ?? null;
}
