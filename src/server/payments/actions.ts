"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { localDateOf } from "@/lib/availability";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getWorkspaceRegional } from "@/server/requests/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { paymentFormSchema, type PaymentFormInput } from "./schemas";

export type PaymentActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const FORBIDDEN: PaymentActionResult = { ok: false, message: "Tu rol no permite registrar pagos." };
const INVALID: PaymentActionResult = { ok: false, message: "Datos inválidos." };
const idSchema = z.uuid();

/** Owner o artista. La RLS y los privilegios por columna lo vuelven a verificar. */
async function editor() {
  const context = await requireWorkspace();
  if (context.role !== "owner" && context.role !== "artist") return null;
  return { workspaceId: context.workspace.id, supabase: await createSupabaseServerClient() };
}

/** Anota un pago recibido (o una devolución). La moneda es la del estudio. */
export async function recordPayment(requestId: string, values: PaymentFormInput): Promise<PaymentActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!idSchema.safeParse(requestId).success) return INVALID;
  const parsed = paymentFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, message: "Revisá los campos marcados.", fieldErrors };
  }

  const regional = await getWorkspaceRegional(session.workspaceId);
  if (parsed.data.paidOn > localDateOf(new Date(), regional.timeZone)) {
    return { ok: false, message: "Revisá los campos marcados.", fieldErrors: { paidOn: "No puede ser una fecha futura." } };
  }
  const { error } = await session.supabase.from("payments").insert({
    workspace_id: session.workspaceId,
    request_id: requestId,
    amount: parsed.data.amount,
    currency: regional.currency,
    kind: parsed.data.kind,
    method: parsed.data.method,
    paid_on: parsed.data.paidOn,
    note: parsed.data.note,
  });
  if (error) {
    console.error("[pagos] recordPayment", error.code);
    return { ok: false, message: "No se pudo guardar. Probá de nuevo." };
  }
  refresh();
  return { ok: true };
}

/** Anula un pago mal cargado. No se borra: queda tachado en el historial. */
export async function voidPayment(paymentId: string): Promise<PaymentActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!idSchema.safeParse(paymentId).success) return INVALID;

  const { data, error } = await session.supabase
    .from("payments")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("workspace_id", session.workspaceId)
    .is("voided_at", null)
    .select("id");
  if (error || data.length === 0) {
    console.error("[pagos] voidPayment", error?.code ?? "sin filas");
    return { ok: false, message: "No se pudo anular el pago." };
  }
  refresh();
  return { ok: true };
}
