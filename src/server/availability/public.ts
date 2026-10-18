import "server-only";
import { resolveRegional, type RegionalSettings } from "@/config/regional";
import { computeSlots, localDateOf, type Slot, type SlotDay, type TimeRange, type Weekday, type WeeklyRule } from "@/lib/availability";
import { formatDateTime } from "@/lib/format";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabasePublicClient } from "@/server/supabase/public";
import { MIN_NOTICE_MINUTES, parseTstzRange } from "./schemas";

/** Cuántos días hacia adelante se ofrecen turnos en la página pública. */
export const PUBLIC_SLOT_DAYS = 21;

export type PublicAvailability = {
  workspaceId: string;
  artistId: string;
  regional: RegionalSettings;
  slots: Slot[];
};

/**
 * Turnos libres de la página pública de `slug`. Que la página esté publicada se comprueba con el
 * rol anon (RLS); horario, bloqueos y turnos confirmados se leen con la clave secreta porque anon
 * no tiene acceso a esas tablas. Al público solo le llegan los inicios y fines de los turnos libres.
 * Devuelve null si la página no existe o no tiene tatuador publicado.
 */
export async function getPublicAvailability(slug: string, now = new Date()): Promise<PublicAvailability | null> {
  const anon = createSupabasePublicClient();
  const { data: workspace } = await anon.from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!workspace) return null;

  const [profileResult, settingsResult] = await Promise.all([
    // Mismo criterio que getPublicArtist: el primer perfil publicado.
    anon.from("artist_profiles").select("id").eq("workspace_id", workspace.id).order("display_name").limit(1).maybeSingle(),
    anon.from("workspace_settings").select("locale, currency, timezone").eq("workspace_id", workspace.id).maybeSingle(),
  ]);
  const profile = profileResult.data;
  if (!profile) return null;
  const regional = resolveRegional({
    locale: settingsResult.data?.locale,
    currency: settingsResult.data?.currency,
    timeZone: settingsResult.data?.timezone,
  });

  const admin = createSupabaseAdminClient();
  // Un margen de 2 días alcanza para cubrir el desfase de zona horaria al principio y al final.
  const window = `[${now.toISOString()},${new Date(now.getTime() + (PUBLIC_SLOT_DAYS + 2) * 86_400_000).toISOString()})`;
  const [rules, blocks, appointments] = await Promise.all([
    admin
      .from("availability_rules")
      .select("weekday, start_time, end_time, slot_minutes, buffer_minutes")
      .eq("artist_id", profile.id),
    admin.from("availability_blocks").select("period").eq("artist_id", profile.id).filter("period", "ov", window),
    admin
      .from("appointments")
      .select("blocked_period")
      .eq("artist_id", profile.id)
      .eq("status", "confirmed")
      .filter("blocked_period", "ov", window),
  ]);
  if (rules.error || blocks.error || appointments.error) throw new Error("No se pudo leer la disponibilidad pública.");

  const weeklyRules = rules.data.map(
    (row): WeeklyRule => ({
      weekday: row.weekday as Weekday,
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5),
      slotMinutes: row.slot_minutes,
      bufferMinutes: row.buffer_minutes,
    }),
  );
  const busy = [
    ...blocks.data.map((row) => parseTstzRange(row.period as string)),
    ...appointments.data.map((row) => parseTstzRange(row.blocked_period as string)),
  ].filter((range): range is TimeRange => range !== null);

  const slots = computeSlots({
    rules: weeklyRules,
    busy,
    timeZone: regional.timeZone,
    from: now,
    days: PUBLIC_SLOT_DAYS,
    minNoticeMinutes: MIN_NOTICE_MINUTES,
  });
  return { workspaceId: workspace.id, artistId: profile.id, regional, slots };
}

/** Turnos agrupados por día y con los textos ya formateados en la zona del estudio, para el formulario. */
export function toSlotDays(slots: Slot[], regional: RegionalSettings): SlotDay[] {
  return [...Map.groupBy(slots, (slot) => localDateOf(slot.start, regional.timeZone))].map(([date, daySlots]) => ({
    date,
    label: formatDateTime(daySlots[0].start, regional, { weekday: "short", day: "numeric", month: "short" }),
    longLabel: formatDateTime(daySlots[0].start, regional, { weekday: "long", day: "numeric", month: "long" }),
    times: daySlots.map((slot) => ({
      value: slot.start.toISOString(),
      label: formatDateTime(slot.start, regional, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    })),
  }));
}
