"use server";

import { refresh } from "next/cache";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { noteSchema, requestIdSchema, statusChangeSchema } from "./schemas";

export type RequestActionResult = { ok: true } | { ok: false; message: string };

const FORBIDDEN: RequestActionResult = { ok: false, message: "Tu rol no permite editar solicitudes." };
const FAILED: RequestActionResult = { ok: false, message: "No se pudo guardar. Probá de nuevo." };
const INVALID: RequestActionResult = { ok: false, message: "Datos inválidos." };

/** Sesión + rol con permiso de escritura. La RLS vuelve a verificarlo en cada consulta. */
async function editor() {
  const context = await requireWorkspace();
  if (context.role !== "owner" && context.role !== "artist") return null;
  return { context, supabase: await createSupabaseServerClient() };
}

/** El historial lo registra un trigger de la base, con el usuario de la sesión. */
export async function changeRequestStatus(requestId: string, status: string): Promise<RequestActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const parsed = statusChangeSchema.safeParse({ requestId, status });
  if (!parsed.success) return INVALID;

  const { data, error } = await session.supabase
    .from("tattoo_requests")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.requestId)
    .eq("workspace_id", session.context.workspace.id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) {
    console.error("[solicitudes] changeRequestStatus", error?.code ?? "sin filas");
    return FAILED;
  }
  refresh();
  return { ok: true };
}

export async function addRequestNote(requestId: string, body: string): Promise<RequestActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const parsed = noteSchema.safeParse({ requestId, body });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { error } = await session.supabase.from("request_notes").insert({
    workspace_id: session.context.workspace.id,
    request_id: parsed.data.requestId,
    body: parsed.data.body,
  });
  if (error) {
    console.error("[solicitudes] addRequestNote", error.code);
    return FAILED;
  }
  refresh();
  return { ok: true };
}

/** Borrado lógico; la RLS solo deja borrar las notas propias. */
export async function deleteRequestNote(noteId: string): Promise<RequestActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!requestIdSchema.safeParse(noteId).success) return INVALID;

  const { data, error } = await session.supabase
    .from("request_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("workspace_id", session.context.workspace.id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) {
    console.error("[solicitudes] deleteRequestNote", error?.code ?? "sin filas");
    return { ok: false, message: "No se pudo borrar la nota." };
  }
  refresh();
  return { ok: true };
}
