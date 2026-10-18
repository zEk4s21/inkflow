import { z } from "zod";

/**
 * Resumen (brief) de la idea que arma el Ink Assistant. Coincide con lo que pide el formulario de
 * consulta más algunos datos que ayudan a presupuestar. Nunca incluye datos de contacto.
 */
export const BRIEF_FIELDS = ["idea", "bodyZone", "sizeLabel", "style", "colorMode", "isCoverUp", "notes"] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];

export const BRIEF_LABELS: Record<BriefField, string> = {
  idea: "Idea",
  bodyZone: "Zona del cuerpo",
  sizeLabel: "Tamaño",
  style: "Estilo",
  colorMode: "Color",
  isCoverUp: "Cubre otro tatuaje",
  notes: "Otros detalles",
};

/** Lo mínimo para mandar la consulta (mismo criterio que el formulario: la idea, más zona y tamaño). */
export const REQUIRED_FIELDS: BriefField[] = ["idea", "bodyZone", "sizeLabel"];

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const briefSchema = z.object({
  idea: text(1000),
  bodyZone: text(60),
  sizeLabel: text(60),
  style: text(60),
  colorMode: z.enum(["black_grey", "color"]).nullable().optional(),
  isCoverUp: z.boolean().nullable().optional(),
  notes: text(500),
});

export type Brief = z.output<typeof briefSchema>;

export const COLOR_LABELS = { black_grey: "Negro y grises", color: "Color" } as const;

/** Texto para mostrar de un campo, o null si falta. */
export function briefValue(brief: Brief, field: BriefField): string | null {
  const value = brief[field];
  if (value === null || value === undefined) return null;
  if (field === "colorMode") return COLOR_LABELS[value as keyof typeof COLOR_LABELS];
  if (field === "isCoverUp") return value ? "Sí" : "No";
  return String(value);
}

/** Ya se puede mandar la consulta: lo decide el servidor con el resumen, nunca el modelo. */
export function isBriefReady(brief: Brief) {
  return REQUIRED_FIELDS.every((field) => briefValue(brief, field) !== null);
}

export function missingFields(brief: Brief): BriefField[] {
  return BRIEF_FIELDS.filter((field) => briefValue(brief, field) === null);
}

/** Lo que ya se sabe no se pierde: el modelo solo puede completar o corregir, nunca borrar. */
export function mergeBrief(current: Brief, update: Brief): Brief {
  const merged: Record<string, unknown> = { ...current };
  // Texto vacío o con solo espacios cuenta como "no dijo nada", no como borrar.
  const normalized = briefSchema.parse(update);
  for (const field of BRIEF_FIELDS) {
    const value = normalized[field];
    if (value !== null && value !== undefined) merged[field] = value;
  }
  return briefSchema.parse(merged);
}

/** Lee un brief guardado (jsonb); si algo no valida, se descarta ese campo y no todo el resumen. */
export function readBrief(value: unknown): Brief {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const brief: Record<string, unknown> = {};
  for (const field of BRIEF_FIELDS) {
    const parsed = briefSchema.shape[field].safeParse(source[field]);
    if (parsed.success && parsed.data !== undefined) brief[field] = parsed.data;
  }
  return brief as Brief;
}
