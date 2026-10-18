import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value));

export const workFieldsSchema = z.object({
  title: z.string().trim().min(1, "Poné un título.").max(80, "Máximo 80 caracteres."),
  category: z.string().trim().min(1, "Elegí o escribí una categoría.").max(40, "Máximo 40 caracteres."),
  bodyZone: optionalText(40),
  description: optionalText(600),
  altText: optionalText(200),
  published: z.boolean(),
});

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const newWorkSchema = workFieldsSchema.extend({
  imagePath: z.string().regex(new RegExp(`^${UUID}/${UUID}\\.(webp|jpg|png)$`), "Foto inválida."),
  imageWidth: z.number().int().positive().max(10000),
  imageHeight: z.number().int().positive().max(10000),
});

export type WorkFields = z.input<typeof workFieldsSchema>;
export type NewWorkInput = z.input<typeof newWorkSchema>;
