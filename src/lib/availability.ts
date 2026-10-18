/**
 * Cálculo de turnos libres a partir del horario semanal, los bloqueos y los turnos ya
 * confirmados. Es puro y no depende de la zona horaria del servidor: todo se
 * interpreta en la zona del workspace.
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WeeklyRule = {
  weekday: Weekday;
  /** Hora local "HH:MM" (acepta "HH:MM:SS" como viene de Postgres). */
  start: string;
  end: string;
  slotMinutes: number;
  bufferMinutes: number;
};

export type TimeRange = { start: Date; end: Date };

/** Turno libre, con el margen que pide la franja que lo generó. */
export type Slot = TimeRange & { bufferMinutes: number };

/** Turnos de un día listos para mostrar: `value` es el inicio en ISO, `label` la hora local. */
export type SlotDay = { date: string; label: string; longLabel: string; times: { value: string; label: string }[] };

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Diferencia entre la hora local de `timeZone` y UTC en ese instante, en ms. */
function offsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return local - Math.floor(instant / 1000) * 1000;
}

/** Instante UTC de una fecha y hora local ("YYYY-MM-DD", "HH:MM") en `timeZone`. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Dos pasadas: la segunda corrige si el primer offset cae del otro lado de un cambio de horario.
  let instant = wall - offsetMs(wall, timeZone);
  instant = wall - offsetMs(instant, timeZone);
  return new Date(instant);
}

/** Fecha local "YYYY-MM-DD" de un instante en `timeZone`. */
export function localDateOf(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY).toISOString().slice(0, 10);
}

function isoWeekday(date: string): Weekday {
  const [year, month, day] = date.split("-").map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst === 0 ? 7 : sundayFirst) as Weekday;
}

const overlaps = (a: TimeRange, b: TimeRange) => a.start < b.end && b.start < a.end;

/**
 * Turnos libres en los próximos `days` días locales, empezando por el día de `from`.
 * Cada franja se divide en turnos de `slotMinutes` separados por `bufferMinutes`; se descartan
 * los que se pisan con un rango ocupado o empiezan antes de `from + minNoticeMinutes`.
 */
export function computeSlots(options: {
  rules: WeeklyRule[];
  busy: TimeRange[];
  timeZone: string;
  from: Date;
  days: number;
  minNoticeMinutes?: number;
}): Slot[] {
  const { rules, busy, timeZone, from, days, minNoticeMinutes = 0 } = options;
  const earliest = from.getTime() + minNoticeMinutes * MINUTE;
  const firstDate = localDateOf(from, timeZone);
  const slots: Slot[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(firstDate, offset);
    const weekday = isoWeekday(date);
    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      const ruleEnd = zonedTimeToUtc(date, rule.end, timeZone).getTime();
      const step = (rule.slotMinutes + rule.bufferMinutes) * MINUTE;
      for (let start = zonedTimeToUtc(date, rule.start, timeZone).getTime(); start + rule.slotMinutes * MINUTE <= ruleEnd; start += step) {
        const slot = { start: new Date(start), end: new Date(start + rule.slotMinutes * MINUTE), bufferMinutes: rule.bufferMinutes };
        if (start < earliest || busy.some((range) => overlaps(slot, range))) continue;
        slots.push(slot);
      }
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
