import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "../../src/types/database.types";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const secretKey = process.env.SUPABASE_SECRET_KEY;
export const hasDatabase = Boolean(supabaseUrl && secretKey);

export function adminClient() {
  return createClient<Database>(supabaseUrl!, secretKey!, { auth: { persistSession: false } });
}

/** Link de ingreso como el del email, generado sin pasar por el correo. */
export async function magicLinkFor(email: string) {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`;
}

export async function signIn(page: Page, email: string) {
  await page.goto(await magicLinkFor(email));
  await page.waitForURL(/\/panel$/);
}
