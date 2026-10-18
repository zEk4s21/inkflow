"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/server/settings/actions";
import { requireWorkspace } from "@/server/auth/panel-context";
import { clientFormSchema, requestIdSchema } from "@/server/requests/schemas";
import { createSupabaseServerClient } from "@/server/supabase/server";

const FORBIDDEN: FormState = { status: "error", message: "Tu rol no permite editar clientes." };
const FAILED: FormState = { status: "error", message: "No se pudo guardar. Probá de nuevo." };

/** Sesión + rol con permiso de escritura. La RLS vuelve a verificarlo en cada consulta. */
async function editor() {
  const context = await requireWorkspace();
  if (context.role !== "owner" && context.role !== "artist") return null;
  return { context, supabase: await createSupabaseServerClient() };
}

export async function updateClient(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!requestIdSchema.safeParse(clientId).success) return FAILED;

  const parsed = clientFormSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    instagramHandle: formData.get("instagramHandle") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors };
  }
  const values = parsed.data;

  const { data, error } = await session.supabase
    .from("clients")
    .update({ name: values.name, email: values.email, phone: values.phone, instagram_handle: values.instagramHandle })
    .eq("id", clientId)
    .eq("workspace_id", session.context.workspace.id)
    .is("deleted_at", null)
    .select("id");

  if (error?.code === "23505") {
    // Otro cliente ya usa ese email o teléfono: es la misma persona, corresponde unirlos.
    const field = error.message.includes("phone") ? "phone" : "email";
    const label = field === "phone" ? "WhatsApp" : "email";
    return {
      status: "error",
      message: `Ya hay otro cliente con ese ${label}. Si es la misma persona, unilos desde su ficha.`,
      fieldErrors: { [field]: `Ya lo usa otro cliente.` },
    };
  }
  if (error || data.length === 0) {
    console.error("[clientes] updateClient", error?.code ?? "sin filas");
    return FAILED;
  }
  refresh();
  return { status: "saved", message: "Cliente guardado." };
}

export type MergeResult = { ok: true } | { ok: false; message: string };

/** Une `sourceId` dentro de `targetId` (la ficha que queda). Lo resuelve una función de la base en una transacción. */
export async function mergeClients(sourceId: string, targetId: string): Promise<MergeResult> {
  const session = await editor();
  if (!session) return { ok: false, message: FORBIDDEN.message! };
  if (!requestIdSchema.safeParse(sourceId).success || !requestIdSchema.safeParse(targetId).success || sourceId === targetId) {
    return { ok: false, message: "Elegí otro cliente." };
  }
  const { error } = await session.supabase.rpc("merge_clients", { source: sourceId, target: targetId });
  if (error) {
    console.error("[clientes] mergeClients", error.code);
    return { ok: false, message: "No se pudieron unir. Probá de nuevo." };
  }
  refresh();
  return { ok: true };
}
