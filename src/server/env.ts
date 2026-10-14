import "server-only";
import { z } from "zod";
import { formatEnvError } from "@/config/env";

/** Secretos de servidor. Este módulo no puede importarse desde componentes de cliente. */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function getServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
  return result.data;
}
