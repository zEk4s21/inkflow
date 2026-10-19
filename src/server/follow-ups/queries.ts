import "server-only";
import type { FollowUpKind } from "@/config/follow-up";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type FollowUp = {
  id: string;
  requestId: string;
  kind: FollowUpKind;
  dueOn: string;
  note: string | null;
  done: boolean;
};

export type PendingFollowUp = FollowUp & { client: { name: string; phone: string | null } };

const COLUMNS = "id, request_id, kind, due_on, note, done_at";

type Row = { id: string; request_id: string; kind: string; due_on: string; note: string | null; done_at: string | null };

function toFollowUp(row: Row): FollowUp {
  return { id: row.id, requestId: row.request_id, kind: row.kind as FollowUpKind, dueOn: row.due_on, note: row.note, done: row.done_at !== null };
}

/** Controles de una solicitud por fecha. La RLS limita a los miembros. */
export async function getRequestFollowUps(workspaceId: string, requestId: string): Promise<FollowUp[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("due_on")
    .order("created_at");
  if (error) throw new Error("No se pudieron leer los controles.");
  return data.map(toFollowUp);
}

/** Controles sin hacer hasta una fecha (incluye los vencidos), con a quién contactar. */
export async function listPendingFollowUps(workspaceId: string, until: string): Promise<PendingFollowUp[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(`${COLUMNS}, tattoo_requests!inner (deleted_at, clients!inner (name, phone))`)
    .eq("workspace_id", workspaceId)
    .is("done_at", null)
    .is("tattoo_requests.deleted_at", null)
    .lte("due_on", until)
    .order("due_on")
    .limit(50);
  if (error) throw new Error("No se pudieron leer los controles.");
  return data.map((row) => ({ ...toFollowUp(row), client: { name: row.tattoo_requests.clients.name, phone: row.tattoo_requests.clients.phone } }));
}
