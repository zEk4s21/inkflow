import { resolveRegional, type RegionalSettings } from "@/config/regional";

/** Único punto de formateo de dinero de la app. */
export function formatMoney(
  amount: number,
  regional?: Partial<RegionalSettings> | null,
): string {
  const { locale, currency } = resolveRegional(regional);
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

/** Formatea una fecha en la zona horaria del workspace, no en la del servidor. */
export function formatDateTime(
  date: Date,
  regional?: Partial<RegionalSettings> | null,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const { locale, timeZone } = resolveRegional(regional);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

export function formatNumber(value: number, regional?: Partial<RegionalSettings> | null): string {
  return new Intl.NumberFormat(resolveRegional(regional).locale).format(value);
}
