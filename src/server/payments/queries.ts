import "server-only";
import type { PaymentKind, PaymentMethod } from "@/config/payment";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type Payment = {
  id: string;
  requestId: string;
  amount: number;
  currency: string;
  kind: PaymentKind;
  method: PaymentMethod;
  paidOn: string;
  note: string | null;
  voided: boolean;
};

/** Pagos de una o varias solicitudes, del más reciente al más viejo. La RLS limita a los miembros. */
export async function getPaymentsForRequests(workspaceId: string, requestIds: string[]): Promise<Payment[]> {
  if (requestIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, request_id, amount, currency, kind, method, paid_on, note, voided_at")
    .eq("workspace_id", workspaceId)
    .in("request_id", requestIds)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron leer los pagos.");
  return data.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    amount: Number(row.amount),
    currency: row.currency,
    kind: row.kind as PaymentKind,
    method: row.method as PaymentMethod,
    paidOn: row.paid_on,
    note: row.note,
    voided: row.voided_at !== null,
  }));
}
