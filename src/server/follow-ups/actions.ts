"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { followUpFormSchema, type FollowUpFormInput } from "./schemas";

export type FollowUpActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const FORBIDDEN: FollowUpActionResult = { ok: false, message: "Tu rol no permite cambiar controles." };
const INVALID: FollowUpActionResult = { ok: false, message: "Datos inválidos." };
const idSchema = z.uuid();

/** Owner o artista. La RLS lo vuelve a verificar. */
async function editor() {
  const context = await requireWorkspace();
  if (context.role !== "owner" && context.role !== "artist") return null;
  return { workspaceId: context.workspace.id, supabase: await createSupabaseServerClient() };
}

/** Un control a mano, con fecha y qué hacer. */
export async function addFollowUp(requestId: string, values: FollowUpFormInput): Promise<FollowUpActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!idSchema.safeParse(requestId).success) return INVALID;
  const parsed = followUpFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, message: "Revisá los campos marcados.", fieldErrors };
  }
  const { error } = await session.supabase.from("follow_ups").insert({
    workspace_id: session.workspaceId,
    request_id: requestId,
    kind: "custom",
    due_on: parsed.data.dueOn,
    note: parsed.data.note,
  });
  if (error) {
    console.error("[controles] addFollowUp", error.code);
    return { ok: false, message: "No se pudo guardar. Probá de nuevo." };
  }
  refresh();
  return { ok: true };
}

/** Marca o desmarca un control como hecho. La fecha y quién lo hizo los pone la base. */
export async function setFollowUpDone(followUpId: string, done: boolean): Promise<FollowUpActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!idSchema.safeParse(followUpId).success || typeof done !== "boolean") return INVALID;
  const { data, error } = await session.supabase
    .from("follow_ups")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", followUpId)
    .eq("workspace_id", session.workspaceId)
    .select("id");
  if (error || data.length === 0) {
    console.error("[controles] setFollowUpDone", error?.code ?? "sin filas");
    return { ok: false, message: "No se pudo actualizar el control." };
  }
  refresh();
  return { ok: true };
}
