import type { FormState } from "@/server/settings/actions";
import { cn } from "@/lib/cn";

export function FormStatus({ state }: { state: FormState }) {
  return (
    <p role="status" className={cn("text-sm", state.status === "error" ? "text-danger" : "text-success")}>
      {state.status === "idle" ? "" : state.message}
    </p>
  );
}
