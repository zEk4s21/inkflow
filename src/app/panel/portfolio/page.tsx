import type { Metadata } from "next";
import Link from "next/link";
import { PanelPageHeader, PendingBadge } from "@/components/panel/page-header";
import { WorkImage } from "@/components/public/work-image";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getPublishedWorks } from "@/server/artists/public-artist";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PanelPortfolioPage() {
  const { workspace } = await requireWorkspace();
  const works = await getPublishedWorks(workspace.slug);

  return (
    <>
      <PanelPageHeader
        title="Portfolio"
        description="Los trabajos que se ven en tu página. Subir, editar y reordenar se habilita en la Fase 2."
        actions={<PendingBadge phase="la Fase 2" />}
      />
      {works.length === 0 ? (
        <EmptyState title="Todavía no publicaste trabajos" description="Subí tu primer trabajo para que aparezca en tu página." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {works.map((work) => (
            <li key={work.id} className="flex flex-col gap-2">
              <Link href={`/artist/${workspace.slug}/work/${work.id}`} className="overflow-hidden rounded-md">
                <WorkImage {...work.image} sizes="(min-width: 1280px) 18vw, (min-width: 640px) 30vw, 45vw" className="w-full" />
              </Link>
              <div className="flex flex-col gap-1.5">
                <span className="truncate text-sm font-medium">{work.title}</span>
                <span className="flex items-center gap-2">
                  <Badge tone="success">Publicado</Badge>
                  <span className="text-xs text-fg-subtle">{work.category}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
