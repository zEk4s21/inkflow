import { z } from "zod";
import { instagramHandleSchema } from "@/server/settings/schemas";
import { REQUEST_STATUSES } from "@/config/request-status";
import { normalizePhone } from "@/lib/phone";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value));

export { normalizePhone } from "@/lib/phone";

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

// Instagram también sirve: muchos clientes de tatuajes solo se manejan por mensaje directo.
const hasContact = (data: { email: string | null; phone: string | null; instagramHandle: string | null }) =>
  data.email !== null || data.phone !== null || data.instagramHandle !== null;

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
  .refine(hasContact, { message: "Dejá un WhatsApp, un email o tu Instagram para responderte.", path: ["phone"] });

export const clientFormSchema = z
  .object(contactFields)
  .refine(hasContact, { message: "Tiene que quedar un WhatsApp, un email o un Instagram.", path: ["phone"] });

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
