import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PanelPageHeader } from "@/components/panel/page-header";
import { PageContentForm } from "@/components/panel/settings/page-content-form";
import { ProfileForm } from "@/components/panel/settings/profile-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { resolveRegional } from "@/config/regional";
import { parseFaq, parseProcess } from "@/server/artists/page-content";
import { signOut } from "@/server/auth/actions";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { workspace, profile, role } = await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("locale, currency, timezone, location_label, instagram_handle, process, faq")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  const regional = resolveRegional({
    locale: settings?.locale,
    currency: settings?.currency,
    timeZone: settings?.timezone,
  });
  const canEdit = role === "owner" && profile !== null;

  return (
    <>
      <PanelPageHeader
        title="Ajustes"
        description={canEdit ? "Lo que cambies acá se ve en tu página pública al guardar." : "Así está configurado el estudio."}
        actions={
          <a href={`/artist/${workspace.slug}`} target="_blank" rel="noopener" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Ver mi página
          </a>
        }
      />

      {canEdit ? (
        <>
          <Card title="Perfil y página">
            <ProfileForm
              slug={workspace.slug}
              initial={{
                displayName: profile.displayName,
                fullName: profile.fullName ?? "",
                bio: profile.bio ?? "",
                styles: profile.styles.join(", "),
                locationLabel: settings?.location_label ?? "",
                instagramHandle: settings?.instagram_handle ?? "",
                isPublic: profile.isPublic,
              }}
            />
          </Card>
          <Card title="Textos de la página">
            <PageContentForm process={parseProcess(settings?.process)} faq={parseFaq(settings?.faq)} />
          </Card>
        </>
      ) : (
        <Card title="Perfil">
          <p className="text-sm text-fg-muted">Solo el owner del estudio puede editar el perfil y la página.</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Región">
          <dl className="flex flex-col divide-y divide-line text-sm">
            {[
              ["Idioma", regional.locale],
              ["Moneda", regional.currency],
              ["Zona horaria", regional.timeZone],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-6">
                <dt className="text-fg-subtle">{label}</dt>
                <dd className="text-fg sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <section className="rounded-lg border border-dashed border-line p-6">
          <h2 className="mb-2 font-medium">Horarios y asistente</h2>
          <p className="text-sm text-fg-muted">
            Días de trabajo, duración de sesiones y reglas del asistente de IA. Se configuran en las Fases 3 y 4.
          </p>
        </section>
      </div>

      {/* En celu y tablet no hay sidebar: la salida está acá. */}
      <form action={signOut} className="lg:hidden">
        <Button type="submit" variant="secondary" className="w-full">
          Salir de la cuenta
        </Button>
      </form>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-line bg-surface-1/40 p-6">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}
