import { z } from "zod";
import { faqSchema, processSchema } from "@/server/artists/page-content";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

/** Acepta "usuario", "@usuario" o la URL del perfil, y devuelve solo el usuario. */
export const instagramHandleSchema = z
  .string()
  .trim()
  .transform((value) =>
    value
      .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/[/?#].*$/, ""),
  )
  .pipe(
    z.union([
      z.literal("").transform(() => null),
      z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Usuario de Instagram inválido."),
    ]),
  );

export const profileFormSchema = z.object({
  displayName: z.string().trim().min(1, "Poné tu nombre artístico.").max(60, "Máximo 60 caracteres."),
  fullName: optionalText(120, "Máximo 120 caracteres."),
  bio: optionalText(2000, "Máximo 2000 caracteres."),
  styles: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((style) => style.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(40, "Cada estilo puede tener hasta 40 caracteres."))
        .max(12, "Máximo 12 estilos."),
    ),
  locationLabel: optionalText(120, "Máximo 120 caracteres."),
  instagramHandle: instagramHandleSchema,
  isPublic: z.boolean(),
});

export type ProfileFormInput = z.input<typeof profileFormSchema>;

export const pageContentSchema = z.object({
  process: processSchema,
  faq: faqSchema,
});
