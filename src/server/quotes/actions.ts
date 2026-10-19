"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getWorkspaceRegional } from "@/server/requests/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { quoteFormSchema, quoteStatusChangeSchema, type QuoteFormInput, type QuoteStatusChange } from "./schemas";

export type QuoteActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const FORBIDDEN: QuoteActionResult = { ok: false, message: "Tu rol no permite armar presupuestos." };
const FAILED: QuoteActionResult = { ok: false, message: "No se pudo guardar. Probá de nuevo." };
const INVALID: QuoteActionResult = { ok: false, message: "Datos inválidos." };
const idSchema = z.uuid();

/** Sesión + rol con permiso de escritura. La RLS y el trigger de la base lo vuelven a verificar. */
async function editor() {
  const context = await requireWorkspace();
  if (context.role !== "owner" && context.role !== "artist") return null;
  return { context, supabase: await createSupabaseServerClient() };
}

function parse(values: QuoteFormInput) {
  const parsed = quoteFormSchema.safeParse(values);
  if (parsed.success) return { data: parsed.data } as const;
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { error: { ok: false, message: "Revisá los campos marcados.", fieldErrors } satisfies QuoteActionResult } as const;
}

function columns(values: NonNullable<ReturnType<typeof parse>["data"]>) {
  return {
    amount: values.amount,
    deposit: values.deposit,
    estimated_sessions: values.estimatedSessions,
    valid_until: values.validUntil,
    message: values.message,
  };
}

/** Crea el presupuesto de una solicitud como borrador o ya enviado. La moneda es la del estudio. */
export async function createQuote(requestId: string, values: QuoteFormInput, send: boolean): Promise<QuoteActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!idSchema.safeParse(requestId).success) return INVALID;
  const parsed = parse(values);
  if (parsed.error) return parsed.error;

  const workspaceId = session.context.workspace.id;
  const regional = await getWorkspaceRegional(workspaceId);
  const { error } = await session.supabase.from("quotes").insert({
    workspace_id: workspaceId,
    request_id: requestId,
    currency: regional.currency,
    status: send ? "sent" : "draft",
    ...columns(parsed.data),
  });
  if (error) {
    // 23505: ya hay un presupuesto abierto para esta solicitud.
    if (error.code === "23505") return { ok: false, message: "Esta solicitud ya tiene un presupuesto abierto." };
    console.error("[presupuestos] createQuote", error.code);
    return FAILED;
  }
  refresh();
  return { ok: true };
}

/** Edita un borrador. Lo enviado no se reescribe (lo frena también la base). */
export async function updateQuote(quoteId: string, values: QuoteFormInput): Promise<QuoteActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!idSchema.safeParse(quoteId).success) return INVALID;
  const parsed = parse(values);
  if (parsed.error) return parsed.error;

  const { data, error } = await session.supabase
    .from("quotes")
    .update(columns(parsed.data))
    .eq("id", quoteId)
    .eq("workspace_id", session.context.workspace.id)
    .eq("status", "draft")
    .select("id");
  if (error || data.length === 0) {
    console.error("[presupuestos] updateQuote", error?.code ?? "sin filas");
    return { ok: false, message: "Solo se puede editar un borrador." };
  }
  refresh();
  return { ok: true };
}

/** Enviar, anotar la respuesta del cliente o retirar. Las transiciones las valida la base. */
export async function changeQuoteStatus(quoteId: string, status: QuoteStatusChange): Promise<QuoteActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!idSchema.safeParse(quoteId).success || !quoteStatusChangeSchema.safeParse(status).success) return INVALID;

  const { data, error } = await session.supabase
    .from("quotes")
    .update({ status })
    .eq("id", quoteId)
    .eq("workspace_id", session.context.workspace.id)
    .select("id");
  if (error || data.length === 0) {
    if (error?.code === "23514") return { ok: false, message: "Ese cambio no está permitido para este presupuesto." };
    console.error("[presupuestos] changeQuoteStatus", error?.code ?? "sin filas");
    return FAILED;
  }
  refresh();
  return { ok: true };
}
