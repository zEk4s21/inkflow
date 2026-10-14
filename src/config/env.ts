import { z } from "zod";

/**
 * Variables públicas (llegan al navegador). Next solo las incluye en el bundle
 * si se leen de forma literal, por eso se listan una por una.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
  return result.data;
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export function formatEnvError(error: z.ZodError): string {
  const missing = error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
  return [
    "Variables de entorno inválidas o faltantes:",
    ...missing,
    "Copiá .env.example a .env.local y completalas (ver README).",
  ].join("\n");
}
