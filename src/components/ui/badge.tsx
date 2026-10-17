import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { REQUEST_STATUS_META, type RequestStatus, type StatusTone } from "@/config/request-status";

const tones: Record<StatusTone, string> = {
  accent: "text-accent bg-accent-soft",
  info: "text-info bg-info/10",
  warning: "text-warning bg-warning/10",
  success: "text-success bg-success/10",
  danger: "text-danger bg-danger/10",
  neutral: "text-fg-muted bg-surface-3",
};

export function Badge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const meta = REQUEST_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
