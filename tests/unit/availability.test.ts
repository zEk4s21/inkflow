import { describe, expect, it } from "vitest";
import { computeSlots, localDateOf, zonedTimeToUtc, type WeeklyRule } from "@/lib/availability";

const BA = "America/Argentina/Buenos_Aires";
const monday: WeeklyRule = { weekday: 1, start: "10:00", end: "18:00", slotMinutes: 180, bufferMinutes: 30 };
// Lunes 19/10/2026 a las 00:00 en Buenos Aires.
const mondayMidnight = new Date("2026-10-19T03:00:00Z");

const iso = (slots: { start: Date }[]) => slots.map((slot) => slot.start.toISOString());

describe("zonedTimeToUtc", () => {
  it("convierte hora de Buenos Aires (UTC-3)", () => {
    expect(zonedTimeToUtc("2026-10-19", "10:00", BA).toISOString()).toBe("2026-10-19T13:00:00.000Z");
  });

  it("respeta el cambio de horario de verano de la zona", () => {
    // Madrid pasa de UTC+1 a UTC+2 el 29/03/2026.
    expect(zonedTimeToUtc("2026-03-28", "10:00", "Europe/Madrid").toISOString()).toBe("2026-03-28T09:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-29", "10:00", "Europe/Madrid").toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("toma la fecha local, no la UTC", () => {
    // 01:30 UTC del martes sigue siendo lunes en Buenos Aires.
    expect(localDateOf(new Date("2026-10-20T01:30:00Z"), BA)).toBe("2026-10-19");
  });
});

describe("computeSlots", () => {
  it("divide la franja en turnos con margen entre turnos y sin pasarse del cierre", () => {
    const slots = computeSlots({ rules: [monday], busy: [], timeZone: BA, from: mondayMidnight, days: 1 });
    // 10:00-13:00 y 13:30-16:30; 17:00-20:00 no entra antes de las 18:00.
    expect(iso(slots)).toEqual(["2026-10-19T13:00:00.000Z", "2026-10-19T16:30:00.000Z"]);
    expect(slots[0].end.toISOString()).toBe("2026-10-19T16:00:00.000Z");
    expect(slots.every((slot) => slot.bufferMinutes === monday.bufferMinutes)).toBe(true);
  });

  it("solo usa los días de la semana configurados y repite cada semana", () => {
    const slots = computeSlots({ rules: [monday], busy: [], timeZone: BA, from: mondayMidnight, days: 14 });
    expect(slots).toHaveLength(4);
    expect(slots.map((slot) => localDateOf(slot.start, BA))).toEqual(["2026-10-19", "2026-10-19", "2026-10-26", "2026-10-26"]);
  });

  it("saca los turnos que se pisan con un bloqueo", () => {
    const busy = [{ start: new Date("2026-10-19T16:00:00Z"), end: new Date("2026-10-19T17:00:00Z") }];
    const slots = computeSlots({ rules: [monday], busy, timeZone: BA, from: mondayMidnight, days: 1 });
    expect(iso(slots)).toEqual(["2026-10-19T13:00:00.000Z"]);
  });

  it("un bloqueo que termina justo cuando empieza el turno no lo saca", () => {
    const busy = [{ start: new Date("2026-10-19T12:00:00Z"), end: new Date("2026-10-19T13:00:00Z") }];
    const slots = computeSlots({ rules: [monday], busy, timeZone: BA, from: mondayMidnight, days: 1 });
    expect(slots).toHaveLength(2);
  });

  it("respeta la anticipación mínima", () => {
    const from = new Date("2026-10-19T12:00:00Z"); // lunes 09:00 local
    const slots = computeSlots({ rules: [monday], busy: [], timeZone: BA, from, days: 1, minNoticeMinutes: 120 });
    expect(iso(slots)).toEqual(["2026-10-19T16:30:00.000Z"]);
  });

  it("ordena turnos de varias franjas", () => {
    const rules: WeeklyRule[] = [
      { weekday: 1, start: "15:00", end: "18:00", slotMinutes: 120, bufferMinutes: 0 },
      { weekday: 1, start: "09:00", end: "11:00", slotMinutes: 120, bufferMinutes: 0 },
    ];
    const slots = computeSlots({ rules, busy: [], timeZone: BA, from: mondayMidnight, days: 1 });
    expect(iso(slots)).toEqual(["2026-10-19T12:00:00.000Z", "2026-10-19T18:00:00.000Z"]);
  });
});

describe("parseTstzRange", () => {
  it("lee el formato de Postgres", async () => {
    const { parseTstzRange } = await import("@/server/availability/schemas");
    const range = parseTstzRange('["2026-12-24 03:00:00+00","2026-12-26 03:00:00+00")');
    expect(range?.start.toISOString()).toBe("2026-12-24T03:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-12-26T03:00:00.000Z");
    expect(parseTstzRange("empty")).toBeNull();
  });
});
