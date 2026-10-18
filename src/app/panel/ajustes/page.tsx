import type { Metadata } from "next";
import { PanelPageHeader, PendingBadge } from "@/components/panel/page-header";
import { Button } from "@/components/ui/button";
import { resolveRegional } from "@/config/regional";
import { signOut } from "@/server/auth/actions";
import { requireWorkspace } from "@/server/auth/panel-context";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { workspace, profile } = await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("locale, currency, timezone, location_label, instagram_handle")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  const regional = resolveRegional({
    locale: settings?.locale,
    currency: settings?.currency,
    timeZone: settings?.timezone,
  });
  const empty = "Sin cargar";
  const sections = [
    { title: "Perfil", rows: [["Nombre", profile?.fullName ?? empty], ["Nombre artístico", profile?.displayName ?? empty], ["Estudio", settings?.location_label ?? empty]] },
    { title: "Página pública", rows: [["Dirección", `/artist/${workspace.slug}`], ["Estilos", profile?.styles.join(", ") || empty], ["Biografía", profile?.bio ?? empty], ["Instagram", settings?.instagram_handle ? `@${settings.instagram_handle}` : empty]] },
    { title: "Región", rows: [["Idioma", regional.locale], ["Moneda", regional.currency], ["Zona horaria", regional.timeZone]] },
  ];

  return (
    <>
      <PanelPageHeader
        title="Ajustes"
        description="Así está configurada tu cuenta hoy. La edición llega en la Fase 2.3."
        actions={<PendingBadge phase="la Fase 2.3" />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-line bg-surface-1 p-6">
            <h2 className="mb-4 font-medium">{section.title}</h2>
            <dl className="flex flex-col divide-y divide-line text-sm">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-6">
                  <dt className="text-fg-subtle">{label}</dt>
                  <dd className="text-fg sm:text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
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
