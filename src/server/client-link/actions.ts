"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getPublicEnv } from "@/config/env";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { clientLinkPath, generateClientToken, hashClientToken } from "./token";

export type ClientLinkResult = { ok: true; url: string } | { ok: false; message: string };

const idSchema = z.uuid();

/** Owner o artista. La RLS de tattoo_requests lo vuelve a verificar. */
async function editor() {
  const context = await requireWorkspace();
  if (context.role !== "owner" && context.role !== "artist") return null;
  return { workspaceId: context.workspace.id, supabase: await createSupabaseServerClient() };
}

/**
 * Genera el link privado de una solicitud y lo devuelve una sola vez: en la base queda solo el
 * hash. Si ya había uno, deja de funcionar.
 */
export async function createClientLink(requestId: string): Promise<ClientLinkResult> {
  const session = await editor();
  if (!session) return { ok: false, message: "Tu rol no permite compartir solicitudes." };
  if (!idSchema.safeParse(requestId).success) return { ok: false, message: "Datos inválidos." };

  const token = generateClientToken();
  const { data, error } = await session.supabase
    .from("tattoo_requests")
    .update({ public_token_hash: hashClientToken(token), public_token_created_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("workspace_id", session.workspaceId)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) {
    console.error("[link-cliente] createClientLink", error?.code ?? "sin filas");
    return { ok: false, message: "No se pudo generar el link. Probá de nuevo." };
  }
  refresh();
  return { ok: true, url: `${getPublicEnv().NEXT_PUBLIC_SITE_URL}${clientLinkPath(token)}` };
}

/** Desactiva el link: quien lo tenga deja de ver la solicitud. */
export async function revokeClientLink(requestId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await editor();
  if (!session) return { ok: false, message: "Tu rol no permite compartir solicitudes." };
  if (!idSchema.safeParse(requestId).success) return { ok: false, message: "Datos inválidos." };

  const { data, error } = await session.supabase
    .from("tattoo_requests")
    .update({ public_token_hash: null, public_token_created_at: null })
    .eq("id", requestId)
    .eq("workspace_id", session.workspaceId)
    .select("id");
  if (error || data.length === 0) {
    console.error("[link-cliente] revokeClientLink", error?.code ?? "sin filas");
    return { ok: false, message: "No se pudo desactivar el link. Probá de nuevo." };
  }
  refresh();
  return { ok: true };
}
