import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AssistantChat } from "@/components/public/assistant-chat";
import { ArtistHeader } from "@/components/public/artist-header";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicArtist, listPublicArtistSlugs } from "@/server/artists/public-artist";
import { isMonthlyBudgetReached, loadConversation } from "@/server/assistant/conversation";
import { toAssistantState } from "@/server/assistant/state";
import { greeting, MAX_USER_MESSAGE } from "@/server/assistant/turn";
import { getAiConfig } from "@/server/integrations/ai";
import { getCaptchaConfig } from "@/server/requests/captcha";
import { createSupabasePublicClient } from "@/server/supabase/public";

export async function generateStaticParams() {
  const slugs = await listPublicArtistSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/artist/[slug]/assistant">): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getPublicArtist(slug);
  if (!artist) return {};
  // Es una conversación privada de cada visitante: no tiene sentido indexarla.
  return { title: `Ink Assistant · ${artist.artistName}`, robots: { index: false } };
}

export default async function AssistantPage({ params }: PageProps<"/artist/[slug]/assistant">) {
  const { slug } = await params;
  const artist = await getPublicArtist(slug);
  if (!artist) notFound();

  return (
    <>
      <ArtistHeader slug={artist.slug} artistName={artist.artistName} />
      <main id="contenido" className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-8 lg:py-24">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">Ink Assistant</p>
          <h1 className="font-display text-5xl uppercase sm:text-6xl">Armá tu idea</h1>
        </div>
        <Suspense fallback={<ChatSkeleton />}>
          <Assistant slug={artist.slug} artistName={artist.artistName} />
        </Suspense>
      </main>
    </>
  );
}

/**
 * La conversación es de cada visitante (cookie) y la configuración se lee en el servidor al momento:
 * se arma en cada visita, fuera de la caché. Al público no se le dice por qué no está disponible
 * (falta la clave, el captcha o el tope del mes): eso lo ve el panel.
 */
async function Assistant({ slug, artistName }: { slug: string; artistName: string }) {
  await connection();
  const config = getAiConfig();
  const captcha = getCaptchaConfig();
  const { data: workspace } = await createSupabasePublicClient().from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (config.status !== "configured" || captcha.mode === "missing" || !workspace) return <Unavailable slug={slug} />;

  const conversation = await loadConversation(workspace.id);
  // Con el tope del mes alcanzado no se ofrece el chat, salvo para ver una consulta ya enviada.
  if (conversation?.status !== "confirmed" && (await isMonthlyBudgetReached(workspace.id, config.monthlyTokenBudget)) !== false) {
    return <Unavailable slug={slug} />;
  }
  return (
    <AssistantChat
      // Al empezar de nuevo cambia la conversación y el chat arranca vacío.
      key={conversation?.id ?? "nueva"}
      slug={slug}
      greeting={greeting(artistName)}
      initialState={toAssistantState(conversation, config.maxMessagesPerConversation)}
      turnstileSiteKey={captcha.mode === "turnstile" ? captcha.siteKey : null}
      simulated={config.provider === "simulated"}
      maxLength={MAX_USER_MESSAGE}
    />
  );
}

function Unavailable({ slug }: { slug: string }) {
  return (
    <div role="status" className="flex max-w-3xl flex-col gap-4 rounded-lg border border-line bg-surface-1 p-6">
      <h2 className="text-lg font-medium">El asistente no está disponible por ahora</h2>
      <p className="leading-relaxed text-fg-muted">
        Mientras tanto, contame tu idea con el formulario: zona, tamaño, estilo y lo que tengas en mente. Te respondo por el medio de contacto que
        dejes.
      </p>
      <Link href={`/artist/${slug}#contacto`} className={buttonClasses({ size: "lg", className: "self-start" })}>
        Ir al formulario
      </Link>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden>
      <Skeleton className="h-96" />
      <Skeleton className="h-80" />
    </div>
  );
}
