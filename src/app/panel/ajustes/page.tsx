import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PanelPageHeader } from "@/components/panel/page-header";
import { CareForm } from "@/components/panel/settings/care-form";
import { EmailStatusCard, type EmailLogEntry } from "@/components/panel/settings/email-status";
import { PageContentForm } from "@/components/panel/settings/page-content-form";
import { ProfileForm } from "@/components/panel/settings/profile-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { resolveRegional } from "@/config/regional";
import { formatPhone } from "@/lib/phone";
import { parseFaq, parseProcess } from "@/server/artists/page-content";
import { signOut } from "@/server/auth/actions";
import { requireWorkspace } from "@/server/auth/panel-context";
import { getEmailStatus } from "@/server/integrations/email";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { workspace, profile, role } = await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("locale, currency, timezone, location_label, instagram_handle, whatsapp_phone, process, faq, care_instructions")
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
                whatsappPhone: settings?.whatsapp_phone ? formatPhone(settings.whatsapp_phone) : "",
                isPublic: profile.isPublic,
              }}
            />
          </Card>
          <Card title="Textos de la página">
            <PageContentForm process={parseProcess(settings?.process)} faq={parseFaq(settings?.faq)} />
          </Card>
          <Card title="Cuidados después de la sesión">
            <CareForm initial={settings?.care_instructions ?? ""} />
          </Card>
        </>
      ) : (
        <Card title="Perfil">
          <p className="text-sm text-fg-muted">Solo el owner del estudio puede editar el perfil y la página.</p>
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
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
        <Card title="Emails">
          <EmailStatusCard status={getEmailStatus()} log={await getEmailLog(workspace.id)} regional={regional} />
        </Card>
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
    <section aria-label={title} className="flex flex-col gap-6 rounded-lg border border-line bg-surface-1/40 p-6">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

/** Últimos avisos por email del estudio (enviados, no enviados o fallidos), leídos con RLS. */
async function getEmailLog(workspaceId: string): Promise<EmailLogEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("email_log")
    .select("id, kind, recipient, status, detail, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((row) => ({ ...row, createdAt: row.created_at }));
}
