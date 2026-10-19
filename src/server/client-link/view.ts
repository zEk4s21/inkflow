import "server-only";
import type { AppointmentStatus } from "@/config/appointment-status";
import type { QuoteStatus } from "@/config/quote-status";
import { resolveRegional, type RegionalSettings } from "@/config/regional";
import type { RequestStatus } from "@/config/request-status";
import { parseTstzRange } from "@/server/availability/schemas";
import type { PaymentKind } from "@/config/payment";
import { paymentTotals } from "@/server/payments/schemas";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { CLIENT_TOKEN_PATTERN, hashClientToken } from "./token";

export type ClientView = {
  artistName: string;
  /** Slug de la página pública, si está publicada. */
  slug: string | null;
  instagramHandle: string | null;
  regional: RegionalSettings;
  firstName: string;
  request: {
    status: RequestStatus;
    idea: string;
    bodyZone: string | null;
    sizeLabel: string | null;
    createdAt: Date;
  };
  quote: {
    amount: number;
    deposit: number | null;
    currency: string;
    estimatedSessions: number | null;
    validUntil: string | null;
    message: string | null;
    status: Extract<QuoteStatus, "sent" | "accepted" | "rejected">;
  } | null;
  /** Cobrado neto (señas y pagos menos devoluciones, sin anulados). */
  paid: number;
  appointments: { start: Date; end: Date; status: Extract<AppointmentStatus, "requested" | "confirmed" | "completed"> }[];
};

const VISIBLE_QUOTES = ["sent", "accepted", "rejected"] as const;
const VISIBLE_APPOINTMENTS = ["requested", "confirmed", "completed"] as const;

/**
 * Lo que ve el cliente con su link. Se lee con la clave secreta (el cliente no tiene sesión), así
 * que acá se elige a mano qué sale: nada de notas, historial, conversación ni datos de contacto.
 * De los pagos sale solo el total cobrado, no el detalle (medio, notas).
 * Borradores y presupuestos retirados no se muestran; turnos cancelados tampoco.
 */
export async function getClientView(token: string): Promise<ClientView | null> {
  if (!CLIENT_TOKEN_PATTERN.test(token)) return null;
  const admin = createSupabaseAdminClient();
  const { data: request } = await admin
    .from("tattoo_requests")
    .select("id, workspace_id, status, idea, body_zone, size_label, created_at, clients!inner (name)")
    .eq("public_token_hash", hashClientToken(token))
    .is("deleted_at", null)
    .maybeSingle();
  if (!request) return null;

  const [workspace, settings, artist, quote, appointments, payments] = await Promise.all([
    admin.from("workspaces").select("slug, name").eq("id", request.workspace_id).single(),
    admin.from("workspace_settings").select("locale, currency, timezone, instagram_handle").eq("workspace_id", request.workspace_id).maybeSingle(),
    admin
      .from("artist_profiles")
      .select("display_name, is_public")
      .eq("workspace_id", request.workspace_id)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    admin
      .from("quotes")
      .select("amount, deposit, currency, estimated_sessions, valid_until, message, status")
      .eq("request_id", request.id)
      .in("status", VISIBLE_QUOTES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("appointments")
      .select("period, status")
      .eq("request_id", request.id)
      .in("status", VISIBLE_APPOINTMENTS),
    admin.from("payments").select("amount, kind").eq("request_id", request.id).is("voided_at", null),
  ]);
  if (workspace.error || settings.error || artist.error || quote.error || appointments.error || payments.error) {
    throw new Error("No se pudo leer el seguimiento.");
  }

  const regional = resolveRegional({
    locale: settings.data?.locale,
    currency: settings.data?.currency,
    timeZone: settings.data?.timezone,
  });
  return {
    artistName: artist.data?.display_name ?? workspace.data.name,
    slug: artist.data?.is_public ? workspace.data.slug : null,
    instagramHandle: settings.data?.instagram_handle ?? null,
    regional,
    firstName: request.clients.name.trim().split(/\s+/)[0],
    request: {
      status: request.status as RequestStatus,
      idea: request.idea,
      bodyZone: request.body_zone,
      sizeLabel: request.size_label,
      createdAt: new Date(request.created_at),
    },
    quote: quote.data && {
      amount: Number(quote.data.amount),
      deposit: quote.data.deposit === null ? null : Number(quote.data.deposit),
      currency: quote.data.currency,
      estimatedSessions: quote.data.estimated_sessions,
      validUntil: quote.data.valid_until,
      message: quote.data.message,
      status: quote.data.status as NonNullable<ClientView["quote"]>["status"],
    },
    paid: paymentTotals(
      payments.data.map((row) => ({ amount: Number(row.amount), kind: row.kind as PaymentKind, voided: false })),
      null,
    ).paid,
    appointments: appointments.data
      .flatMap((row) => {
        const period = parseTstzRange(row.period as string);
        return period ? [{ ...period, status: row.status as ClientView["appointments"][number]["status"] }] : [];
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime()),
  };
}
