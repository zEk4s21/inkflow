"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { PORTFOLIO_BUCKET } from "@/lib/storage";
import { artistCacheTag } from "@/server/artists/public-artist";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { newWorkSchema, workFieldsSchema, type NewWorkInput, type WorkFields } from "./schemas";

export type WorkActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const FORBIDDEN: WorkActionResult = { ok: false, message: "Tu rol no permite editar el portfolio." };
const FAILED: WorkActionResult = { ok: false, message: "No se pudo guardar. Probá de nuevo." };

/** Sesión + rol con permiso de escritura. La RLS vuelve a verificarlo en cada consulta. */
async function editor() {
  const context = await requireWorkspace();
  if (context.role !== "owner" && context.role !== "artist") return null;
  return { context, supabase: await createSupabaseServerClient() };
}

function invalid(error: z.ZodError): WorkActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false, message: "Revisá los campos marcados.", fieldErrors };
}

function done(slug: string): WorkActionResult {
  updateTag(artistCacheTag(slug));
  refresh();
  return { ok: true };
}

export async function createWork(input: NewWorkInput): Promise<WorkActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const { context, supabase } = session;

  const parsed = newWorkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const work = parsed.data;
  if (!work.imagePath.startsWith(`${context.workspace.id}/`)) return { ok: false, message: "Foto inválida." };

  // La foto la sube el navegador; acá se confirma que existe antes de referenciarla.
  const [folder, fileName] = work.imagePath.split("/");
  const { data: files } = await supabase.storage.from(PORTFOLIO_BUCKET).list(folder, { search: fileName });
  if (!files?.some((file) => file.name === fileName)) {
    return { ok: false, message: "La foto no terminó de subirse. Probá de nuevo." };
  }

  // Los nuevos van primero.
  const { data: first } = await supabase
    .from("portfolio_items")
    .select("position")
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .order("position")
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("portfolio_items").insert({
    workspace_id: context.workspace.id,
    title: work.title,
    category: work.category,
    body_zone: work.bodyZone,
    description: work.description,
    alt_text: work.altText ?? work.title,
    status: work.published ? "published" : "draft",
    position: (first?.position ?? 1) - 1,
    image_path: work.imagePath,
    image_width: work.imageWidth,
    image_height: work.imageHeight,
  });
  if (error) {
    console.error("[portfolio] createWork", error.code);
    return FAILED;
  }
  return done(context.workspace.slug);
}

export async function updateWork(id: string, input: WorkFields): Promise<WorkActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const { context, supabase } = session;

  const parsed = workFieldsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const work = parsed.data;

  const { data, error } = await supabase
    .from("portfolio_items")
    .update({
      title: work.title,
      category: work.category,
      body_zone: work.bodyZone,
      description: work.description,
      alt_text: work.altText ?? work.title,
      status: work.published ? "published" : "draft",
    })
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length !== 1) {
    console.error("[portfolio] updateWork", error?.code);
    return FAILED;
  }
  return done(context.workspace.slug);
}

export async function setWorkPublished(id: string, published: boolean): Promise<WorkActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const { context, supabase } = session;

  const { data, error } = await supabase
    .from("portfolio_items")
    .update({ status: published ? "published" : "draft" })
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length !== 1) return FAILED;
  return done(context.workspace.slug);
}

/** Intercambia la posición con el vecino de arriba (-1) o de abajo (+1). */
export async function moveWork(id: string, direction: -1 | 1): Promise<WorkActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const { context, supabase } = session;

  const { data: works, error } = await supabase
    .from("portfolio_items")
    .select("id, position")
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .order("position")
    .order("created_at", { ascending: false });
  if (error) return FAILED;

  const index = works.findIndex((work) => work.id === id);
  const neighbor = works[index + direction];
  if (index === -1 || !neighbor) return { ok: true };

  // Se renumera toda la lista para que no queden posiciones repetidas.
  const ordered = works.map((work) => work.id);
  [ordered[index], ordered[index + direction]] = [ordered[index + direction], ordered[index]];
  const updates = await Promise.all(
    ordered.map((workId, position) =>
      supabase.from("portfolio_items").update({ position }).eq("id", workId).eq("workspace_id", context.workspace.id),
    ),
  );
  if (updates.some((result) => result.error)) return FAILED;
  return done(context.workspace.slug);
}

export async function deleteWork(id: string): Promise<WorkActionResult> {
  const session = await editor();
  if (!session) return FORBIDDEN;
  const { context, supabase } = session;

  const { data, error } = await supabase
    .from("portfolio_items")
    .update({ deleted_at: new Date().toISOString(), status: "draft" })
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .is("deleted_at", null)
    .select("image_path");
  if (error || data.length !== 1) return FAILED;

  // La foto se borra para que deje de ser accesible por URL.
  const removed = await supabase.storage.from(PORTFOLIO_BUCKET).remove([data[0].image_path]);
  if (removed.error) console.error("[portfolio] deleteWork storage", removed.error.message);
  return done(context.workspace.slug);
}
