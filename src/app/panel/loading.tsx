import { Skeleton } from "@/components/ui/skeleton";

/** Mientras llegan los datos de cada página del panel (dependen de la sesión) se ve esto. */
export default function PanelLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando">
      <Skeleton className="h-12 w-56" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
