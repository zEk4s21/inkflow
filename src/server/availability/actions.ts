"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { blockSchema, weeklyAvailabilitySchema, type BlockInput, type WeeklyAvailabilityInput } from "./schemas";

export type AvailabilityResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const FORBIDDEN: AvailabilityResult = { ok: false, message: "Tu rol no permite cambiar la agenda." };
const FAILED: AvailabilityResult = { ok: false, message: "No se pudo guardar. Probá de nuevo." };

/** Sesión, rol con permiso de escritura y perfil de artista. La base vuelve a verificar el rol. */
async function editor() {
  const context = await requireWorkspace();
  if ((context.role !== "owner" && context.role !== "artist") || !context.profile) return null;
  return { artistId: context.profile.id, supabase: await createSupabaseServerClient() };
}

function invalid(error: z.ZodError): AvailabilityResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false, message: "Revisá los campos marcados.", fieldErrors };
}

export async function saveWeeklyAvailability(input: WeeklyAvailabilityInput): Promise<AvailabilityResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const parsed = weeklyAvailabilitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { days, slotMinutes, bufferMinutes } = parsed.data;

  const rules = days
    .filter((day) => day.enabled)
    .map((day) => ({ weekday: day.weekday, start_time: day.start, end_time: day.end, slot_minutes: slotMinutes, buffer_minutes: bufferMinutes }));
  const { error } = await session.supabase.rpc("set_weekly_availability", { target_artist: session.artistId, rules });
  if (error) {
    console.error("[agenda] saveWeeklyAvailability", error.code);
    return FAILED;
  }
  refresh();
  return { ok: true };
}

export async function addBlock(input: BlockInput): Promise<AvailabilityResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const block = parsed.data;

  const { error } = await session.supabase.rpc("add_availability_block", {
    target_artist: session.artistId,
    start_date: block.startDate,
    end_date: block.endDate,
    start_time: block.allDay ? undefined : block.startTime,
    end_time: block.allDay ? undefined : block.endTime,
    reason: block.reason || undefined,
  });
  if (error) {
    console.error("[agenda] addBlock", error.code);
    return FAILED;
  }
  refresh();
  return { ok: true };
}

export async function deleteBlock(blockId: string): Promise<AvailabilityResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  if (!z.uuid().safeParse(blockId).success) return FAILED;
  const { data, error } = await session.supabase
    .from("availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("artist_id", session.artistId)
    .select("id");
  if (error || data.length === 0) {
    console.error("[agenda] deleteBlock", error?.code ?? "sin filas");
    return { ok: false, message: "No se pudo borrar el bloqueo." };
  }
  refresh();
  return { ok: true };
}
