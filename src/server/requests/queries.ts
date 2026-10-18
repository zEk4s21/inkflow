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
    .select("id, status, source, idea, body_zone, size_label, created_at, clients!inner (id, name, email, phone, instagram_handle)")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
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
