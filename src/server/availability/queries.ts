import "server-only";
import type { Weekday, WeeklyRule } from "@/lib/availability";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { parseTstzRange } from "./schemas";

export type AvailabilityBlock = { id: string; start: Date; end: Date; reason: string | null };

/** Horario semanal y bloqueos vigentes (o futuros) de un tatuador. La RLS limita a los miembros. */
export async function getAvailability(artistId: string) {
  const supabase = await createSupabaseServerClient();
  const [rules, blocks] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("weekday, start_time, end_time, slot_minutes, buffer_minutes")
      .eq("artist_id", artistId)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("availability_blocks")
      .select("id, period, reason")
      .eq("artist_id", artistId)
      .filter("period", "ov", `[${new Date().toISOString()},infinity)`),
  ]);
  if (rules.error || blocks.error) throw new Error("No se pudo leer la disponibilidad.");

  return {
    rules: rules.data.map(
      (row): WeeklyRule => ({
        weekday: row.weekday as Weekday,
        start: row.start_time.slice(0, 5),
        end: row.end_time.slice(0, 5),
        slotMinutes: row.slot_minutes,
        bufferMinutes: row.buffer_minutes,
      }),
    ),
    blocks: blocks.data
      .flatMap((row): AvailabilityBlock[] => {
        const period = parseTstzRange(row.period as string);
        return period ? [{ id: row.id, ...period, reason: row.reason }] : [];
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime()),
  };
}
