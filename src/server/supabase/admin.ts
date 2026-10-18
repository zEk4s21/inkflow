import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/config/env";
import { getServerEnv } from "@/server/env";
import type { Database } from "@/types/database.types";

/**
 * Cliente con la clave secreta: SALTEA LA RLS. Usarlo solo después de validar en el
 * servidor todo lo que la RLS no puede chequear (captcha, límites, pertenencia).
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
