import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PanelPageHeader } from "@/components/panel/page-header";
import { CareForm } from "@/components/panel/settings/care-form";
import { PageContentForm } from "@/components/panel/settings/page-content-form";
import { ProfileForm } from "@/components/panel/settings/profile-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { resolveRegional, type RegionalSettings } from "@/config/regional";
import { formatNumber } from "@/lib/format";
import { parseFaq, parseProcess } from "@/server/artists/page-content";
import { signOut } from "@/server/auth/actions";
import { requireWorkspace } from "@/server/auth/panel-context";
import { monthStartUtc } from "@/server/assistant/conversation";
import { getAiStatus, type AIStatus } from "@/server/integrations/ai";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { workspace, profile, role } = await requireWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("locale, currency, timezone, location_label, instagram_handle, process, faq, care_instructions")
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
          <Card title="Cuidados después de la sesión">
            <CareForm initial={settings?.care_instructions ?? ""} />
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
        <Card title="Ink Assistant">
          <AssistantStatus status={getAiStatus()} usage={await getMonthlyAiUsage(workspace.id)} regional={regional} />
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

/** Estado de la IA leído de las variables del servidor. Nunca muestra la clave. */
/** Consumo del mes (UTC, igual que el tope), leído con la sesión del miembro (RLS). */
async function getMonthlyAiUsage(workspaceId: string): Promise<AIUsage | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("workspace_ai_usage", { p_workspace: workspaceId, p_since: monthStartUtc().toISOString() })
    .single();
  return error ? null : data;
}

type AIUsage = { conversations: number; requests: number; tokens: number };

function AssistantStatus({ status, usage, regional }: { status: AIStatus; usage: AIUsage | null; regional: RegionalSettings }) {
  if (status.status === "configured") {
    const budget = status.monthlyTokenBudget;
    const share = usage && budget ? Math.min(1, usage.tokens / budget) : null;
    return (
      <div className="flex flex-col gap-4 text-sm">
        <span className="self-start">
          {status.simulated ? <Badge tone="warning">Simulado (sin IA)</Badge> : <Badge tone="success">Configurado</Badge>}
        </span>
        <dl className="flex flex-col divide-y divide-line">
          {[
            ["Proveedor", status.providerLabel],
            ["Modelo", status.model],
            ["Mensajes por conversación", `Hasta ${status.maxMessagesPerConversation}`],
            ["Presupuesto mensual", status.monthlyTokenBudget ? `${formatNumber(status.monthlyTokenBudget, regional)} tokens` : "Sin tope"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-6">
              <dt className="text-fg-subtle">{label}</dt>
              <dd className="text-fg sm:text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-3">
          <h3 className="text-fg-subtle">Este mes</h3>
          {usage ? (
            <>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  ["Conversaciones", usage.conversations],
                  ["Consultas enviadas", usage.requests],
                  ["Tokens", usage.tokens],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1 rounded-md border border-line p-3">
                    <dt className="text-xs text-fg-subtle">{label}</dt>
                    <dd className="text-lg tabular-nums">{formatNumber(Number(value), regional)}</dd>
                  </div>
                ))}
              </dl>
              {share !== null && budget ? (
                <div className="flex flex-col gap-2">
                  <div
                    role="meter"
                    aria-label="Tokens usados del tope mensual"
                    aria-valuemin={0}
                    aria-valuemax={budget}
                    aria-valuenow={Math.min(usage.tokens, budget)}
                    className="h-2 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div className={share >= 1 ? "h-full bg-danger" : share >= 0.8 ? "h-full bg-warning" : "h-full bg-success"} style={{ width: `${share * 100}%` }} />
                  </div>
                  <p className={share >= 1 ? "text-danger" : "text-fg-muted"}>
                    {share >= 1
                      ? "Llegaste al tope del mes: el asistente se muestra como no disponible hasta el día 1 y las consultas siguen entrando por el formulario."
                      : `${formatNumber(Math.round(share * 100), regional)} % del tope mensual.`}
                  </p>
                </div>
              ) : (
                <p className="text-fg-muted">Sin tope mensual: para poner uno, cargá AI_MONTHLY_TOKEN_BUDGET_PER_WORKSPACE en el servidor.</p>
              )}
            </>
          ) : (
            <p className="text-fg-muted">No se pudo leer el consumo del mes.</p>
          )}
          <p className="text-xs text-fg-subtle">
            El mes se cuenta en UTC. El costo en plata depende del modelo: se ve en la consola del proveedor.
          </p>
        </div>
        <p className="text-fg-muted">
          {status.simulated
            ? "Las respuestas son fijas y la página lo avisa: sirve solo para probar la pantalla, nunca en producción."
            : "Los clientes ya pueden conversar con el asistente en tu página y mandarte la consulta desde ahí."}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 text-sm">
      <span className="self-start">
        <Badge tone="warning">No configurado</Badge>
      </span>
      {status.status === "missing" ? (
        <p className="text-fg-muted">
          Falta cargar en el servidor: {status.missing.map((name) => <code key={name} className="mx-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-xs">{name}</code>)}.
        </p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-fg-muted">
          {status.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <p className="text-fg-muted">Mientras tanto, tu página sigue recibiendo consultas por el formulario.</p>
    </div>
  );
}
