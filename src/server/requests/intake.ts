import "server-only";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { RATE_LIMITS } from "./rate-limit";

// Alta de consultas públicas (formulario y asistente), siempre con la clave secreta.

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Límite de consultas por hora, compartido por el formulario y el asistente: por conexión
 * (`hash`, HMAC de la IP) y por estudio. Devuelve null si no se pudo consultar.
 */
export async function isRequestRateLimited(admin: Admin, workspaceId: string, hash: string | null): Promise<boolean | null> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [bySubmitter, byWorkspace] = await Promise.all([
    hash
      ? admin.from("tattoo_requests").select("id", { count: "exact", head: true }).eq("submitter_hash", hash).gte("created_at", since)
      : Promise.resolve({ count: 0, error: null }),
    admin.from("tattoo_requests").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", since),
  ]);
  if (bySubmitter.error || byWorkspace.error) return null;
  return (bySubmitter.count ?? 0) >= RATE_LIMITS.perSubmitter || (byWorkspace.count ?? 0) >= RATE_LIMITS.perWorkspace;
}

type Contact = { name: string; email: string | null; phone: string | null; instagramHandle: string | null };

/**
 * Mismo email o teléfono = mismo cliente. No pisa datos existentes con lo que escribió
 * alguien en un formulario público; solo completa los que faltaban.
 */
export async function findOrCreateClient(admin: Admin, workspaceId: string, contact: Contact): Promise<string | null> {
  const match = async () => {
    for (const [column, value] of [["email", contact.email], ["phone", contact.phone]] as const) {
      if (!value) continue;
      const { data } = await admin
        .from("clients")
        .select("id, email, phone, instagram_handle")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .ilike(column, value.replace(/[%_\\]/g, "\\$&"))
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
    return null;
  };

  const existing = await match();
  if (existing) {
    const missing = {
      ...(existing.email ? {} : contact.email ? { email: contact.email } : {}),
      ...(existing.phone ? {} : contact.phone ? { phone: contact.phone } : {}),
      ...(existing.instagram_handle ? {} : contact.instagramHandle ? { instagram_handle: contact.instagramHandle } : {}),
    };
    if (Object.keys(missing).length > 0) {
      // Puede chocar con otro cliente que ya tenga ese dato: en ese caso se deja como estaba.
      await admin.from("clients").update(missing).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data, error } = await admin
    .from("clients")
    .insert({
      workspace_id: workspaceId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      instagram_handle: contact.instagramHandle,
    })
    .select("id")
    .single();
  if (data) return data.id;
  // Carrera con otro envío simultáneo del mismo contacto: se reintenta la búsqueda.
  if (error?.code === "23505") return (await match())?.id ?? null;
  console.error("[requests] client insert", error?.code);
  return null;
}
