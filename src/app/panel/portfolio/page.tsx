import type { Metadata } from "next";
import { PanelPageHeader } from "@/components/panel/page-header";
import { NewWorkForm } from "@/components/panel/portfolio/new-work-form";
import { WorkCard, type PanelWork } from "@/components/panel/portfolio/work-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicEnv } from "@/config/env";
import { portfolioImageUrl } from "@/lib/storage";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PanelPortfolioPage() {
  const { workspace, role } = await requireWorkspace();
  const canEdit = role === "owner" || role === "artist";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("portfolio_items")
    .select("id, title, category, body_zone, description, alt_text, status, image_path, image_width, image_height")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("position")
    .order("created_at", { ascending: false });

  const supabaseUrl = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  const works: PanelWork[] = (data ?? []).map((work) => ({
    id: work.id,
    title: work.title,
    category: work.category,
    bodyZone: work.body_zone,
    description: work.description,
    altText: work.alt_text,
    published: work.status === "published",
    image: { src: portfolioImageUrl(supabaseUrl, work.image_path), width: work.image_width, height: work.image_height },
  }));
  const categories = [...new Set(works.map((work) => work.category))].sort((a, b) => a.localeCompare(b, "es"));
  const publishedCount = works.filter((work) => work.published).length;

  return (
    <>
      <PanelPageHeader
        title="Portfolio"
        description={`${publishedCount} publicados de ${works.length}. El orden de esta lista es el de tu página.`}
        actions={
          <a href={`/artist/${workspace.slug}#trabajos`} target="_blank" rel="noopener" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Ver en mi página
          </a>
        }
      />
      {canEdit && <NewWorkForm workspaceId={workspace.id} categories={categories} />}
      {works.length === 0 ? (
        <EmptyState title="Todavía no hay trabajos" description="Subí tu primer trabajo para que aparezca en tu página." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {works.map((work, index) => (
            <WorkCard
              key={work.id}
              work={work}
              categories={categories}
              canEdit={canEdit}
              isFirst={index === 0}
              isLast={index === works.length - 1}
            />
          ))}
        </ul>
      )}
    </>
  );
}
