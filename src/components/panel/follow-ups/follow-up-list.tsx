import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { RegionalSettings } from "@/config/regional";
import { FOLLOW_UP_LABELS } from "@/config/follow-up";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { FollowUp, PendingFollowUp } from "@/server/follow-ups/queries";
import { followUpTiming } from "@/server/follow-ups/schemas";
import { FollowUpToggle } from "./follow-up-toggle";

function formatDay(date: string, regional: RegionalSettings) {
  return formatDateTime(new Date(`${date}T00:00:00Z`), { ...regional, timeZone: "UTC" }, { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Controles de una solicitud, o pendientes del estudio (con `withClient`: nombre, link a la
 * solicitud y WhatsApp para escribirle, porque INKFLOW no le avisa solo).
 */
export function FollowUpList({
  items,
  today,
  regional,
  canEdit,
  withClient = false,
}: {
  items: (FollowUp | PendingFollowUp)[];
  today: string;
  regional: RegionalSettings;
  canEdit: boolean;
  withClient?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {items.map((item) => {
        const timing = followUpTiming(item.dueOn, today);
        const label = item.kind === "custom" && item.note ? item.note : FOLLOW_UP_LABELS[item.kind];
        const client = "client" in item ? item.client : null;
        return (
          <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className={cn("flex min-w-0 flex-col gap-1", item.done && "text-fg-subtle line-through")}>
              <span className="flex flex-wrap items-center gap-2">
                {withClient && client ? (
                  <Link href={`/panel/solicitudes/${item.requestId}`} className="font-medium underline-offset-4 hover:underline">
                    {client.name}
                  </Link>
                ) : null}
                <span>{label}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                <span className="first-letter:uppercase">{formatDay(item.dueOn, regional)}</span>
                {!item.done && timing === "overdue" && <Badge tone="warning">Vencido</Badge>}
                {!item.done && timing === "today" && <Badge tone="accent">Hoy</Badge>}
                {withClient && client?.phone && (
                  <a href={`https://wa.me/${client.phone}`} target="_blank" rel="noopener" className="underline-offset-4 hover:text-fg hover:underline">
                    WhatsApp
                  </a>
                )}
              </span>
            </div>
            {canEdit && <FollowUpToggle followUpId={item.id} done={item.done} label={withClient && client ? `${label} (${client.name})` : label} />}
          </li>
        );
      })}
    </ul>
  );
}
