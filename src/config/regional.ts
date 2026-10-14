/**
 * Configuración regional por defecto de INKFLOW.
 * Cada workspace puede sobrescribir estos valores desde su configuración;
 * ningún componente debe asumir moneda, idioma ni zona horaria por su cuenta.
 */
export type RegionalSettings = {
  locale: string;
  currency: string;
  timeZone: string;
};

export const DEFAULT_REGIONAL: RegionalSettings = {
  locale: "es-AR",
  currency: "ARS",
  timeZone: "America/Argentina/Buenos_Aires",
};

export function resolveRegional(
  overrides?: Partial<RegionalSettings> | null,
): RegionalSettings {
  return { ...DEFAULT_REGIONAL, ...stripEmpty(overrides ?? {}) };
}

function stripEmpty(values: Partial<RegionalSettings>): Partial<RegionalSettings> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "string" && value.length > 0),
  );
}
