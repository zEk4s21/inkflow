import type { Metadata } from "next";
import Link from "next/link";
import { CopyLinkButton } from "@/components/panel/copy-link-button";
import { PanelPageHeader, PendingBadge } from "@/components/panel/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getPublishedWorks } from "@/server/artists/public-artist";

export const metadata: Metadata = { title: "Inicio" };

export default async function PanelHome() {
  const { workspace } = await requireWorkspace();
  const works = await getPublishedWorks(workspace.slug);

  return (
    <>
      <PanelPageHeader title="Inicio" description="Lo que necesita tu atención hoy." />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="nuevas" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="nuevas" className="text-sm font-medium text-fg-muted">
              Solicitudes nuevas
            </h2>
            <PendingBadge phase="la Fase 2" />
          </div>
          <EmptyState
            title="Todavía no hay solicitudes"
            description="Cuando alguien te consulte desde tu página, la vas a ver acá. Compartí tu link en la bio de Instagram."
            action={<CopyLinkButton path={`/artist/${workspace.slug}`} />}
          />
        </section>

        <section aria-labelledby="turnos" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="turnos" className="text-sm font-medium text-fg-muted">
              Próximos turnos
            </h2>
            <PendingBadge phase="la Fase 3" />
          </div>
          <div className="rounded-lg border border-line bg-surface-1 p-6 text-sm text-fg-muted">
            No hay turnos cargados. La agenda se habilita en la Fase 3.
          </div>
        </section>
      </div>

      <section aria-labelledby="accesos" className="flex flex-col gap-4">
        <h2 id="accesos" className="text-sm font-medium text-fg-muted">
          Accesos rápidos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink href="/panel/portfolio" title="Portfolio" detail={`${works.length} trabajos publicados`} />
          <QuickLink href={`/artist/${workspace.slug}`} title="Mi página pública" detail={`/artist/${workspace.slug}`} />
          <QuickLink href="/panel/ajustes" title="Ajustes" detail="Perfil, horarios y región" />
        </div>
      </section>
    </>
  );
}

function QuickLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg border border-line bg-surface-1 p-5 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex flex-col gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-fg-subtle">{detail}</span>
      </span>
      <span aria-hidden className="text-fg-subtle transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
