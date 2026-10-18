"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { zonedTimeToUtc } from "@/lib/availability";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getWorkspaceRegional } from "@/server/requests/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  appointmentStatusChangeSchema,
  appointmentTimeSchema,
  type AppointmentStatusChange,
  type AppointmentTimeInput,
} from "./schemas";

export type AppointmentResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const FORBIDDEN: AppointmentResult = { ok: false, message: "Tu rol no permite gestionar turnos." };
const FAILED: AppointmentResult = { ok: false, message: "No se pudo guardar. Probá de nuevo." };
const OVERLAP: AppointmentResult = {
  ok: false,
  message: "Se pisa con otro turno confirmado (contando el margen entre turnos). Elegí otro horario.",
};

/** Sesión, rol con permiso de escritura y perfil de artista. La base vuelve a verificar el rol. */
async function editor() {
  const context = await requireWorkspace();
  if ((context.role !== "owner" && context.role !== "artist") || !context.profile) return null;
  return { workspaceId: context.workspace.id, artistId: context.profile.id, supabase: await createSupabaseServerClient() };
}

function failure(error: { code?: string; message?: string }, where: string): AppointmentResult {
  // Lo rechaza la restricción de exclusión: otro turno confirmado ocupa ese horario.
  if (error.code === "23P01") return OVERLAP;
  if (error.code === "23514") {
    if (error.message?.includes("todavía no empezó")) return { ok: false, message: "El turno todavía no empezó." };
    return { ok: false, message: "Ese cambio no se puede hacer con el estado actual del turno. Recargá la página." };
  }
  console.error(`[turnos] ${where}`, error.code);
  return FAILED;
}

function invalid(error: z.ZodError): AppointmentResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false, message: "Revisá los campos marcados.", fieldErrors };
}

async function toPeriod(workspaceId: string, input: z.infer<typeof appointmentTimeSchema>) {
  const { timeZone } = await getWorkspaceRegional(workspaceId);
  const start = zonedTimeToUtc(input.date, input.time, timeZone);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  return `[${start.toISOString()},${end.toISOString()})`;
}

export async function changeAppointmentStatus(appointmentId: string, status: AppointmentStatusChange): Promise<AppointmentResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!z.uuid().safeParse(appointmentId).success || !appointmentStatusChangeSchema.safeParse(status).success) return FAILED;

  const { data, error } = await session.supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("workspace_id", session.workspaceId)
    .select("id");
  if (error) return failure(error, "changeAppointmentStatus");
  if (data.length === 0) return FAILED;
  refresh();
  return { ok: true };
}

export async function rescheduleAppointment(appointmentId: string, input: AppointmentTimeInput): Promise<AppointmentResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!z.uuid().safeParse(appointmentId).success) return FAILED;
  const parsed = appointmentTimeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await session.supabase
    .from("appointments")
    .update({ period: await toPeriod(session.workspaceId, parsed.data) })
    .eq("id", appointmentId)
    .eq("workspace_id", session.workspaceId)
    .select("id");
  if (error) return failure(error, "rescheduleAppointment");
  if (data.length === 0) return FAILED;
  refresh();
  return { ok: true };
}

/** Turno dado a mano desde una solicitud: queda confirmado, con el margen del horario semanal. */
export async function createAppointment(requestId: string, input: AppointmentTimeInput): Promise<AppointmentResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!z.uuid().safeParse(requestId).success) return FAILED;
  const parsed = appointmentTimeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [request, rule] = await Promise.all([
    session.supabase
      .from("tattoo_requests")
      .select("client_id")
      .eq("id", requestId)
      .eq("workspace_id", session.workspaceId)
      .is("deleted_at", null)
      .maybeSingle(),
    session.supabase.from("availability_rules").select("buffer_minutes").eq("artist_id", session.artistId).limit(1).maybeSingle(),
  ]);
  if (!request.data) return FAILED;

  const { error } = await session.supabase.from("appointments").insert({
    workspace_id: session.workspaceId,
    artist_id: session.artistId,
    client_id: request.data.client_id,
    request_id: requestId,
    period: await toPeriod(session.workspaceId, parsed.data),
    buffer_minutes: rule.data?.buffer_minutes ?? 0,
    status: "confirmed",
    source: "manual",
  });
  if (error) return failure(error, "createAppointment");
  refresh();
  return { ok: true };
}
