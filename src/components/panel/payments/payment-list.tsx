import type { RegionalSettings } from "@/config/regional";
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/config/payment";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Payment } from "@/server/payments/queries";
import { VoidPaymentButton } from "./void-payment-button";

/** paid_on es una fecha sin hora: se formatea en UTC para que no cambie de día. */
export function formatPaidOn(date: string, regional: RegionalSettings) {
  return formatDateTime(new Date(`${date}T00:00:00Z`), { ...regional, timeZone: "UTC" }, { dateStyle: "medium" });
}

export function PaymentList({ payments, regional, canEdit }: { payments: Payment[]; regional: RegionalSettings; canEdit: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {payments.map((payment) => {
        const money = formatMoney(payment.amount, { ...regional, currency: payment.currency });
        const label = `${PAYMENT_KIND_LABELS[payment.kind]} de ${money}`;
        return (
          <li key={payment.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className={cn("flex flex-col gap-1", payment.voided && "text-fg-subtle line-through")}>
              <span>
                <span className="tabular-nums">{payment.kind === "refund" ? `− ${money}` : money}</span> · {PAYMENT_KIND_LABELS[payment.kind]}
              </span>
              <span className="text-xs text-fg-subtle">
                {formatPaidOn(payment.paidOn, regional)} · {PAYMENT_METHOD_LABELS[payment.method]}
                {payment.note && ` · ${payment.note}`}
              </span>
            </div>
            {payment.voided ? (
              <span className="text-xs text-fg-subtle">Anulado</span>
            ) : (
              canEdit && <VoidPaymentButton paymentId={payment.id} label={label} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
