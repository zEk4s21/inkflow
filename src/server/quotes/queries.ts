import "server-only";
import type { QuoteStatus } from "@/config/quote-status";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type Quote = {
  id: string;
  requestId: string;
  amount: number;
  deposit: number | null;
  currency: string;
  estimatedSessions: number | null;
  validUntil: string | null;
  message: string | null;
  status: QuoteStatus;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
};

const COLUMNS = "id, request_id, amount, deposit, currency, estimated_sessions, valid_until, message, status, sent_at, responded_at, created_at";

type Row = {
  id: string;
  request_id: string;
  amount: number | string;
  deposit: number | string | null;
  currency: string;
  estimated_sessions: number | null;
  valid_until: string | null;
  message: string | null;
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
};

// numeric llega como número o texto según el tamaño: se normaliza a number.
function toQuote(row: Row): Quote {
  return {
    id: row.id,
    requestId: row.request_id,
    amount: Number(row.amount),
    deposit: row.deposit === null ? null : Number(row.deposit),
    currency: row.currency,
    estimatedSessions: row.estimated_sessions,
    validUntil: row.valid_until,
    message: row.message,
    status: row.status as QuoteStatus,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
  };
}

/** Presupuestos de una solicitud, el más nuevo primero. La RLS limita a los miembros. */
export async function getRequestQuotes(workspaceId: string, requestId: string): Promise<Quote[]> {
  return getQuotesForRequests(workspaceId, [requestId]);
}

/** Presupuestos de varias solicitudes (por ejemplo, las de un cliente), el más nuevo primero. */
export async function getQuotesForRequests(workspaceId: string, requestIds: string[]): Promise<Quote[]> {
  if (requestIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .in("request_id", requestIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron leer los presupuestos.");
  return data.map(toQuote);
}
