import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type WorkspaceRole = "owner" | "artist" | "staff";

export type PanelContext =
  | { status: "no-access"; email: string | null }
  | {
      status: "ok";
      userId: string;
      email: string | null;
      role: WorkspaceRole;
      workspace: { id: string; slug: string; name: string };
      profile: {
        id: string;
        displayName: string;
        fullName: string | null;
        bio: string | null;
        styles: string[];
        isPublic: boolean;
      } | null;
    };

/**
 * Sesión y workspace del usuario actual. Redirige a /ingresar si no hay sesión.
 * Primera barrera de autorización; la segunda es la RLS de cada tabla.
 * `cache` evita repetir las consultas dentro de un mismo render.
 */
export const getPanelContext = cache(async (): Promise<PanelContext> => {
  const supabase = await createSupabaseServerClient();
  // getClaims valida la firma del JWT; getSession solo lee la cookie y no es confiable.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/ingresar");
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  // v1: un usuario pertenece a un solo workspace. Con varios, se toma el más antiguo.
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner (id, slug, name, deleted_at)")
    .eq("user_id", userId)
    .is("workspaces.deleted_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) return { status: "no-access", email };

  const workspace = membership.workspaces;
  const { data: profiles } = await supabase
    .from("artist_profiles")
    .select("id, user_id, display_name, full_name, bio, styles, is_public")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at");

  // El perfil propio si existe; si no (owner que no tatúa), el primero del estudio.
  const profile = profiles?.find((p) => p.user_id === userId) ?? profiles?.[0] ?? null;

  return {
    status: "ok",
    userId,
    email,
    role: membership.role as WorkspaceRole,
    workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name },
    profile: profile && {
      id: profile.id,
      displayName: profile.display_name,
      fullName: profile.full_name,
      bio: profile.bio,
      styles: profile.styles,
      isPublic: profile.is_public,
    },
  };
});

/** Para páginas del panel: solo continúa con un workspace válido (el layout ya filtró el resto). */
export async function requireWorkspace() {
  const context = await getPanelContext();
  if (context.status !== "ok") redirect("/panel");
  return context;
}
