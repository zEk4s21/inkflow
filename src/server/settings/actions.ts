"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { artistCacheTag } from "@/server/artists/public-artist";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { careInstructionsSchema, pageContentSchema, profileFormSchema } from "./schemas";

export type FormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

const FORBIDDEN: FormState = { status: "error", message: "Solo el owner del estudio puede editar la página." };
const FAILED: FormState = { status: "error", message: "No se pudo guardar. Probá de nuevo." };

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const context = await requireWorkspace();
  // La RLS también lo exige; este chequeo da un mensaje claro y evita la consulta.
  if (context.role !== "owner") return FORBIDDEN;
  if (!context.profile) return { status: "error", message: "Este estudio no tiene un perfil de artista." };

  const parsed = profileFormSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    fullName: formData.get("fullName") ?? "",
    bio: formData.get("bio") ?? "",
    styles: formData.get("styles") ?? "",
    locationLabel: formData.get("locationLabel") ?? "",
    instagramHandle: formData.get("instagramHandle") ?? "",
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors: fieldErrors(parsed.error) };
  }
  const values = parsed.data;

  const supabase = await createSupabaseServerClient();
  const [profile, settings] = await Promise.all([
    supabase
      .from("artist_profiles")
      .update({
        display_name: values.displayName,
        full_name: values.fullName,
        bio: values.bio,
        styles: values.styles,
        is_public: values.isPublic,
      })
      .eq("id", context.profile.id)
      .eq("workspace_id", context.workspace.id)
      .select("id"),
    supabase
      .from("workspace_settings")
      .update({ location_label: values.locationLabel, instagram_handle: values.instagramHandle })
      .eq("workspace_id", context.workspace.id)
      .select("workspace_id"),
  ]);

  if (profile.error || settings.error || profile.data.length !== 1 || settings.data.length !== 1) {
    console.error("[settings] updateProfile", profile.error?.code, settings.error?.code);
    return FAILED;
  }

  updateTag(artistCacheTag(context.workspace.slug));
  return { status: "saved", message: "Cambios guardados." };
}

export async function updatePageContent(_prev: FormState, formData: FormData): Promise<FormState> {
  const context = await requireWorkspace();
  if (context.role !== "owner") return FORBIDDEN;

  let raw: unknown;
  try {
    raw = { process: JSON.parse(String(formData.get("process"))), faq: JSON.parse(String(formData.get("faq"))) };
  } catch {
    return { status: "error", message: "Datos inválidos." };
  }

  const parsed = pageContentSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspace_settings")
    .update({ process: parsed.data.process, faq: parsed.data.faq })
    .eq("workspace_id", context.workspace.id)
    .select("workspace_id");

  if (error || data.length !== 1) {
    console.error("[settings] updatePageContent", error?.code);
    return FAILED;
  }

  updateTag(artistCacheTag(context.workspace.slug));
  return { status: "saved", message: "Cambios guardados." };
}

/** Indicaciones de cuidado que ve el cliente en su link cuando la sesión ya se hizo. */
export async function updateCareInstructions(_prev: FormState, formData: FormData): Promise<FormState> {
  const context = await requireWorkspace();
  if (context.role !== "owner") return FORBIDDEN;

  const parsed = careInstructionsSchema.safeParse(formData.get("careInstructions") ?? "");
  if (!parsed.success) {
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors: { careInstructions: parsed.error.issues[0].message } };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspace_settings")
    .update({ care_instructions: parsed.data })
    .eq("workspace_id", context.workspace.id)
    .select("workspace_id");
  if (error || data.length !== 1) {
    console.error("[settings] updateCareInstructions", error?.code);
    return FAILED;
  }
  return { status: "saved", message: "Cambios guardados." };
}
