import { z } from "zod";

/** Textos de la página pública guardados como jsonb en workspace_settings. */
export const processStepSchema = z.object({
  title: z.string().trim().min(1, "Falta el título del paso.").max(80),
  description: z.string().trim().min(1, "Falta la descripción del paso.").max(400),
});

export const faqItemSchema = z.object({
  question: z.string().trim().min(1, "Falta la pregunta.").max(160),
  answer: z.string().trim().min(1, "Falta la respuesta.").max(800),
});

export const processSchema = z.array(processStepSchema).max(10, "Máximo 10 pasos.");
export const faqSchema = z.array(faqItemSchema).max(15, "Máximo 15 preguntas.");

export type ProcessStep = z.infer<typeof processStepSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;

/** Lectura tolerante: descarta lo que no tenga la forma esperada en vez de romper la página. */
export function parseProcess(value: unknown): ProcessStep[] {
  return Array.isArray(value) ? value.flatMap((item) => tryParse(processStepSchema, item)) : [];
}

export function parseFaq(value: unknown): FaqItem[] {
  return Array.isArray(value) ? value.flatMap((item) => tryParse(faqItemSchema, item)) : [];
}

function tryParse<T>(schema: z.ZodType<T>, item: unknown): T[] {
  const result = schema.safeParse(item);
  return result.success ? [result.data] : [];
}
