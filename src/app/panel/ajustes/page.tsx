import type { Metadata } from "next";
import { PanelPageHeader, PendingBadge } from "@/components/panel/page-header";
import { DEFAULT_REGIONAL } from "@/config/regional";
import { DEMO_ARTIST } from "@/server/artists/demo-data";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  const artist = DEMO_ARTIST;
  const sections = [
    { title: "Perfil", rows: [["Nombre", artist.fullName], ["Nombre artístico", artist.artistName], ["Estudio", artist.locationLabel]] },
    { title: "Página pública", rows: [["Dirección", `/artist/${artist.slug}`], ["Estilos", artist.styles.join(", ")], ["Biografía", artist.bio ?? "Sin cargar"]] },
    { title: "Región", rows: [["Idioma", DEFAULT_REGIONAL.locale], ["Moneda", DEFAULT_REGIONAL.currency], ["Zona horaria", DEFAULT_REGIONAL.timeZone]] },
  ];

  return (
    <>
      <PanelPageHeader
        title="Ajustes"
        description="Así está configurada tu cuenta hoy. La edición se habilita en la Fase 2."
        actions={<PendingBadge phase="la Fase 2" />}
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
    </>
  );
}
