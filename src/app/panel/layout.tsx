import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ExternalIcon } from "@/components/panel/icons";
import { MobileSettingsLink, PanelBottomBar, PanelSidebar } from "@/components/panel/panel-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/server/auth/actions";
import { getPanelContext } from "@/server/auth/panel-context";

export const metadata: Metadata = {
  title: { template: "%s · Panel INKFLOW", default: "Panel INKFLOW" },
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  // La sesión se lee en el request: va detrás de Suspense para no bloquear el resto.
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}

async function PanelShell({ children }: { children: ReactNode }) {
  const context = await getPanelContext();

  if (context.status === "no-access") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
        <h1 className="font-display text-4xl uppercase">Tu cuenta no tiene un estudio</h1>
        <p className="text-sm leading-relaxed text-fg-muted">
          Entraste como <span className="text-fg">{context.email ?? "usuario sin email"}</span>, pero esa cuenta no está
          asociada a ningún estudio. Pedile acceso a quien administra INKFLOW.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Salir
          </Button>
        </form>
      </main>
    );
  }

  const name = context.profile?.fullName ?? context.profile?.displayName ?? context.workspace.name;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r border-line px-4 py-6 lg:flex">
        <Link href="/panel" className="px-3 font-display text-2xl uppercase">
          Inkflow
        </Link>
        <PanelSidebar />
        <div className="mt-auto flex flex-col gap-3 border-t border-line px-3 pt-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-fg">{name}</span>
            <span className="truncate text-xs text-fg-subtle">{context.email}</span>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="-ml-4">
              Salir
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-ink/85 px-4 backdrop-blur-md sm:px-8">
          <span className="font-display text-xl uppercase lg:hidden">Inkflow</span>
          <span className="hidden text-sm text-fg-muted lg:block">Hola, {name.split(" ")[0]}</span>
          <div className="flex items-center gap-1">
            <a
              href={`/artist/${context.workspace.slug}`}
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

function PanelSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy>
      <div className="hidden w-60 shrink-0 border-r border-line lg:block" />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-24 sm:px-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
