import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalIcon } from "@/components/panel/icons";
import { MobileSettingsLink, PanelBottomBar, PanelSidebar } from "@/components/panel/panel-nav";
import { DEMO_ARTIST } from "@/server/artists/demo-data";
import { isPanelPreviewAllowed } from "@/server/panel-access";

export const metadata: Metadata = {
  title: { template: "%s · Panel INKFLOW", default: "Panel INKFLOW" },
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  if (!isPanelPreviewAllowed()) notFound();
  // Hasta la Fase 2 el panel muestra al tatuador demo; después sale de la sesión.
  const artist = DEMO_ARTIST;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r border-line px-4 py-6 lg:flex">
        <Link href="/panel" className="px-3 font-display text-2xl uppercase">
          Inkflow
        </Link>
        <PanelSidebar />
        <div className="mt-auto flex flex-col gap-1 border-t border-line px-3 pt-4 text-sm">
          <span className="text-fg">{artist.fullName}</span>
          <span className="text-xs text-fg-subtle">Vista previa sin login</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-ink/85 px-4 backdrop-blur-md sm:px-8">
          <span className="font-display text-xl uppercase lg:hidden">Inkflow</span>
          <span className="hidden text-sm text-fg-muted lg:block">Hola, {artist.fullName.split(" ")[0]}</span>
          <div className="flex items-center gap-1">
            <a
              href={`/artist/${artist.slug}`}
              target="_blank"
              rel="noopener"
              className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              <ExternalIcon className="size-4" />
              <span>Ver mi página</span>
            </a>
            <MobileSettingsLink />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-10 px-4 pt-8 pb-28 sm:px-8 lg:pb-12">{children}</main>
      </div>

      <PanelBottomBar />
    </div>
  );
}
