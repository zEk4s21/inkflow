import Link from "next/link";
import { RequestStatusBadge } from "@/components/ui/badge";
import type { RegionalSettings } from "@/config/regional";
import { formatDateTime } from "@/lib/format";
import type { RequestSummary } from "@/server/requests/queries";

export function RequestList({ requests, regional }: { requests: RequestSummary[]; regional: RegionalSettings }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            href={`/panel/solicitudes/${request.id}`}
            className="flex flex-col gap-2 bg-surface-1/40 px-4 py-4 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-6"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-medium">{request.client.name}</span>
              <span className="truncate text-sm text-fg-muted">{request.idea}</span>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
              <RequestStatusBadge status={request.status} />
              <time dateTime={request.createdAt.toISOString()} className="text-xs text-fg-subtle">
                {formatDateTime(request.createdAt, regional)}
              </time>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
