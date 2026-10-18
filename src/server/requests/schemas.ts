import { z } from "zod";
import { instagramHandleSchema } from "@/server/settings/schemas";
import { REQUEST_STATUSES } from "@/config/request-status";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value));

/** Deja solo dígitos. "+54 9 11 2233-4455" → "5491122334455". */
export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

// Datos de contacto: los comparten el formulario público y la edición de clientes del panel.
const contactFields = {
  name: z.string().trim().min(1, "Falta el nombre.").max(120, "Máximo 120 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.email({ error: "Email inválido." }).max(254).nullable()),
  phone: z
    .string()
    .transform(normalizePhone)
    .transform((value) => (value === "" ? null : value))
    .pipe(z.string().regex(/^[0-9]{6,15}$/, "Teléfono inválido.").nullable()),
  instagramHandle: instagramHandleSchema,
};

const hasContact = (data: { email: string | null; phone: string | null }) => data.email !== null || data.phone !== null;

export const requestFormSchema = z
  .object({
    ...contactFields,
    name: z.string().trim().min(1, "Decinos tu nombre.").max(120, "Máximo 120 caracteres."),
    idea: z.string().trim().min(10, "Contá un poco más de tu idea (mínimo 10 caracteres).").max(3000, "Máximo 3000 caracteres."),
    bodyZone: optionalText(60),
    sizeLabel: optionalText(60),
    // Inicio del turno elegido (ISO en UTC) o vacío. Que siga libre lo verifica la Server Action.
    slot: z
      .string()
      .default("")
      .transform((value) => (value === "" ? null : value))
      .pipe(z.iso.datetime({ error: "Turno inválido." }).nullable()),
  })
  .refine(hasContact, { message: "Dejá un email o un teléfono para responderte.", path: ["email"] });

/** Confirmación del Ink Assistant: el resumen (ya revisado y editable) más los datos de contacto. */
export const assistantRequestSchema = z
  .object({
    ...contactFields,
    name: z.string().trim().min(1, "Decinos tu nombre.").max(120, "Máximo 120 caracteres."),
    idea: z.string().trim().min(10, "Contá un poco más de tu idea (mínimo 10 caracteres).").max(3000, "Máximo 3000 caracteres."),
    bodyZone: optionalText(60),
    sizeLabel: optionalText(60),
    style: optionalText(60),
    colorMode: z.enum(["", "black_grey", "color"], { error: "Opción inválida." }).transform((value) => (value === "" ? null : value)),
    isCoverUp: z.enum(["", "yes", "no"], { error: "Opción inválida." }).transform((value) => (value === "" ? null : value === "yes")),
    details: optionalText(500),
    // Sin la confirmación explícita de la persona no se crea nada.
    confirmed: z.literal("on", { error: "Tildá la confirmación para enviar." }),
  })
  .refine(hasContact, { message: "Dejá un email o un teléfono para responderte.", path: ["email"] });

export const clientFormSchema = z
  .object(contactFields)
  .refine(hasContact, { message: "Tiene que quedar un email o un WhatsApp.", path: ["email"] });

export type ClientFormValues = z.input<typeof clientFormSchema>;

export type RequestFormValues = z.input<typeof requestFormSchema>;

export const requestIdSchema = z.uuid();

export const statusChangeSchema = z.object({
  requestId: requestIdSchema,
  status: z.enum(REQUEST_STATUSES),
});

export const noteSchema = z.object({
  requestId: requestIdSchema,
  body: z
    .string()
    .trim()
    .min(1, "Escribí la nota.")
    .max(2000, "Máximo 2000 caracteres."),
});
