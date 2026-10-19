import "server-only";
import { cache } from "react";
import { resolveRegional } from "@/config/regional";
import type { RequestStatus } from "@/config/request-status";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type RequestSummary = {
  id: string;
  status: RequestStatus;
  idea: string;
  createdAt: Date;
  client: { id: string; name: string };
};

/** Configuración regional del workspace (zona horaria para mostrar fechas). */
export const getWorkspaceRegional = cache(async (workspaceId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_settings")
    .select("locale, currency, timezone")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return resolveRegional({ locale: data?.locale, currency: data?.currency, timeZone: data?.timezone });
});

/** Solicitudes del workspace, más nuevas primero. La RLS limita a los miembros. */
export async function listRequests(workspaceId: string, options: { status?: RequestStatus; limit?: number } = {}) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("tattoo_requests")
    .select("id, status, idea, created_at, clients!inner (id, name)")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (options.status) query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron leer las solicitudes: ${error.message}`);
  return data.map(
    (row): RequestSummary => ({
      id: row.id,
      status: row.status as RequestStatus,
      idea: row.idea,
      createdAt: new Date(row.created_at),
      client: { id: row.clients.id, name: row.clients.name },
    }),
  );
}

export async function getRequest(workspaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tattoo_requests")
    .select(
      "id, status, source, idea, body_zone, size_label, style, color_mode, is_cover_up, details, conversation_id, public_token_created_at, created_at, clients!inner (id, name, email, phone, instagram_handle)",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/** Mensajes de la conversación con el asistente que generó la consulta (lectura con RLS). */
export async function getConversationMessages(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (error) throw new Error("No se pudo leer la conversación con el asistente.");
  return data;
}

export async function listClients(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, email, phone, instagram_handle, created_at, tattoo_requests (count)")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`);
  return data;
}

export type RequestActivity =
  | { kind: "status"; id: string; at: Date; from: RequestStatus; to: RequestStatus; by: string | null }
  | { kind: "note"; id: string; at: Date; body: string; by: string | null };

/** Historial de estados y notas de una solicitud, del más viejo al más nuevo. */
export async function getRequestActivity(workspaceId: string, requestId: string): Promise<RequestActivity[]> {
  const supabase = await createSupabaseServerClient();
  const [history, notes] = await Promise.all([
    supabase
      .from("request_status_history")
      .select("id, from_status, to_status, changed_by, created_at")
      .eq("workspace_id", workspaceId)
      .eq("request_id", requestId),
    supabase
      .from("request_notes")
      .select("id, body, author_id, created_at")
      .eq("workspace_id", workspaceId)
      .eq("request_id", requestId)
      .is("deleted_at", null),
  ]);
  if (history.error || notes.error) throw new Error("No se pudo leer el historial de la solicitud.");
  return [
    ...history.data.map(
      (row): RequestActivity => ({
        kind: "status",
        id: row.id,
        at: new Date(row.created_at),
        from: row.from_status as RequestStatus,
        to: row.to_status as RequestStatus,
        by: row.changed_by,
      }),
    ),
    ...notes.data.map(
      (row): RequestActivity => ({ kind: "note", id: row.id, at: new Date(row.created_at), body: row.body, by: row.author_id }),
    ),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Nombre visible de cada miembro con perfil de artista (para firmar historial y notas). */
export async function getMemberNames(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("artist_profiles")
    .select("user_id, display_name")
    .eq("workspace_id", workspaceId)
    .not("user_id", "is", null);
  return new Map((data ?? []).map((row) => [row.user_id!, row.display_name]));
}

/** Cantidad de solicitudes por estado, para los filtros del listado. */
export async function countRequestsByStatus(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tattoo_requests")
    .select("status")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .limit(5000);
  if (error) throw new Error(`No se pudieron contar las solicitudes: ${error.message}`);
  const counts = new Map<RequestStatus, number>();
  for (const row of data) counts.set(row.status as RequestStatus, (counts.get(row.status as RequestStatus) ?? 0) + 1);
  return { total: data.length, byStatus: counts };
}

/** Ficha de un cliente con sus solicitudes, más nuevas primero. */
export async function getClient(workspaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, email, phone, instagram_handle, created_at, tattoo_requests (id, status, idea, created_at, deleted_at)")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const requests = data.tattoo_requests
    .filter((request) => request.deleted_at === null)
    .map(
      (request): RequestSummary => ({
        id: request.id,
        status: request.status as RequestStatus,
        idea: request.idea,
        createdAt: new Date(request.created_at),
        client: { id: data.id, name: data.name },
      }),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { ...data, requests };
}
