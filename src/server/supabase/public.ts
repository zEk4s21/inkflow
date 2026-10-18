import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/config/env";
import type { Database } from "@/types/database.types";

/**
 * Cliente sin sesión (rol anon) para leer datos públicos. No toca cookies, así que
 * se puede usar dentro de funciones con "use cache". La RLS limita qué devuelve.
 */
export function createSupabasePublicClient() {
  const env = getPublicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
