"use server";

import { headers } from "next/headers";
import type { RegionalSettings } from "@/config/regional";
import type { Slot } from "@/lib/availability";
import { formatDateTime } from "@/lib/format";
import { getPublicAvailability } from "@/server/availability/public";
import { getServerEnv } from "@/server/env";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabasePublicClient } from "@/server/supabase/public";
import { getCaptchaConfig, verifyTurnstile } from "./captcha";
import { clientIp, RATE_LIMITS, submitterHash } from "./rate-limit";
import { requestFormSchema } from "./schemas";

export type RequestFormState =
  | { status: "idle" }
  | { status: "sent"; slot?: { label: string } | { failed: true } }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const UNAVAILABLE: RequestFormState = { status: "error", message: "El formulario no está disponible ahora. Escribí por Instagram." };
const FAILED: RequestFormState = { status: "error", message: "No se pudo enviar. Probá de nuevo en un rato." };

export async function submitRequest(slug: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  // Campo trampa invisible: si viene completo es un bot. Se responde "enviado" para no darle pistas.
  if (String(formData.get("website") ?? "") !== "") return { status: "sent" };

  const parsed = requestFormSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    instagramHandle: formData.get("instagramHandle") ?? "",
    idea: formData.get("idea") ?? "",
    bodyZone: formData.get("bodyZone") ?? "",
    sizeLabel: formData.get("sizeLabel") ?? "",
    slot: formData.get("slot") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors };
  }
  const values = parsed.data;

  const captcha = getCaptchaConfig();
  if (captcha.mode === "missing") return UNAVAILABLE;
  const ip = clientIp(await headers());
  if (captcha.mode === "turnstile") {
    const token = String(formData.get("cf-turnstile-response") ?? "");
    if (!(await verifyTurnstile(token, captcha.secretKey, ip))) {
      return { status: "error", message: "No pudimos verificar que no seas un robot. Probá de nuevo." };
    }
  }

  // Solo se aceptan consultas para páginas publicadas (lectura con el rol anon).
  const { data: workspace } = await createSupabasePublicClient()
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!workspace) return UNAVAILABLE;

  const admin = createSupabaseAdminClient();
  const hash = ip ? submitterHash(ip, getServerEnv().SUPABASE_SECRET_KEY) : null;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [bySubmitter, byWorkspace] = await Promise.all([
    hash
      ? admin.from("tattoo_requests").select("id", { count: "exact", head: true }).eq("submitter_hash", hash).gte("created_at", since)
      : Promise.resolve({ count: 0, error: null }),
    admin.from("tattoo_requests").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).gte("created_at", since),
  ]);
  if (bySubmitter.error || byWorkspace.error) return FAILED;
  if ((bySubmitter.count ?? 0) >= RATE_LIMITS.perSubmitter || (byWorkspace.count ?? 0) >= RATE_LIMITS.perWorkspace) {
    return { status: "error", message: "Recibimos varias consultas seguidas. Esperá un rato o escribí por Instagram." };
  }

  // El turno elegido tiene que seguir libre según el horario, los bloqueos y los turnos confirmados
  // de ahora: no se confía en la lista que vio el navegador.
  let slot: (Slot & { artistId: string; regional: RegionalSettings }) | null = null;
  if (values.slot) {
    const availability = await getPublicAvailability(slug).catch(() => null);
    const start = new Date(values.slot).getTime();
    const free = availability?.workspaceId === workspace.id ? availability.slots.find((candidate) => candidate.start.getTime() === start) : null;
    if (!availability || !free) {
      return {
        status: "error",
        message: "Ese turno ya no está disponible. Elegí otro o mandá la consulta sin turno.",
        fieldErrors: { slot: "Elegí otro turno." },
      };
    }
    slot = { ...free, artistId: availability.artistId, regional: availability.regional };
  }

  const clientId = await findOrCreateClient(admin, workspace.id, values);
  if (!clientId) return FAILED;

  const { data: request, error } = await admin.from("tattoo_requests").insert({
    workspace_id: workspace.id,
    client_id: clientId,
    source: "form",
    idea: values.idea,
    body_zone: values.bodyZone,
    size_label: values.sizeLabel,
    submitter_hash: hash,
  }).select("id").single();
  if (error) {
    console.error("[requests] insert", error.code);
    return FAILED;
  }
  if (!slot) return { status: "sent" };

  // El turno queda "requested": no reserva nada hasta que el tatuador lo confirme (Fase 3.3).
  const { error: appointmentError } = await admin.from("appointments").insert({
    workspace_id: workspace.id,
    artist_id: slot.artistId,
    client_id: clientId,
    request_id: request.id,
    period: `[${slot.start.toISOString()},${slot.end.toISOString()})`,
    buffer_minutes: slot.bufferMinutes,
    status: "requested",
    source: "form",
  });
  if (appointmentError) {
    // La consulta ya entró; se avisa con honestidad que el turno no quedó anotado.
    console.error("[requests] appointment insert", appointmentError.code);
    return { status: "sent", slot: { failed: true } };
  }
  const day = formatDateTime(slot.start, slot.regional, { weekday: "long", day: "numeric", month: "long" });
  const time = formatDateTime(slot.start, slot.regional, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return { status: "sent", slot: { label: `${day} a las ${time}` } };
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Contact = { name: string; email: string | null; phone: string | null; instagramHandle: string | null };

/**
 * Mismo email o teléfono = mismo cliente. No pisa datos existentes con lo que escribió
 * alguien en un formulario público; solo completa los que faltaban.
 */
async function findOrCreateClient(admin: Admin, workspaceId: string, contact: Contact): Promise<string | null> {
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
