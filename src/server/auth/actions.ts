"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnv } from "@/config/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email?: string };

const emailSchema = z.email({ error: "Ingresá un email válido." }).max(254);

export async function requestMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Email inválido.", email: raw };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      // No se crean cuentas desde el login: las da de alta el administrador.
      shouldCreateUser: false,
      emailRedirectTo: `${getPublicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  if (error?.status === 429) {
    return { status: "error", message: "Pediste varios links seguidos. Esperá unos minutos y probá de nuevo.", email: raw };
  }
  if (error && error.code !== "otp_disabled" && error.code !== "signup_disabled" && error.status !== 422) {
    console.error("[auth] signInWithOtp", error.code, error.status);
    return { status: "error", message: "No pudimos enviar el link. Probá de nuevo en un rato.", email: raw };
  }

  // Misma respuesta exista o no la cuenta, para no revelar qué emails tienen acceso.
  return { status: "sent", email: parsed.data };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
