import "server-only";
import { getPublicEnv } from "@/config/env";
import { sendEmail, type EmailMessage } from "@/server/integrations/email";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { newRequestForArtist, requestReceivedForClient } from "./templates";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Avisos de una consulta nueva: al equipo (owner y artistas) y, si dejó email, al cliente. Sin
 * proveedor de email no se manda nada y queda anotado como "skipped". Nunca hace fallar la
 * consulta: se llama después de guardarla y los errores solo se registran.
 */
export async function notifyNewRequest(input: { workspaceId: string; requestId: string; source: string; clientName: string; clientEmail: string | null }) {
  try {
    const admin = createSupabaseAdminClient();
    const [team, artist] = await Promise.all([
      teamEmails(admin, input.workspaceId),
      admin.from("artist_profiles").select("display_name").eq("workspace_id", input.workspaceId).order("created_at").limit(1).maybeSingle(),
    ]);
    const panelUrl = `${getPublicEnv().NEXT_PUBLIC_SITE_URL}/panel/solicitudes/${input.requestId}`;

    const jobs: { message: EmailMessage; kind: "new_request_artist" | "request_received_client"; recipient: "artist" | "client" }[] = team.map((to) => ({
      message: newRequestForArtist({ to, clientName: input.clientName, source: input.source, panelUrl, requestId: input.requestId }),
      kind: "new_request_artist",
      recipient: "artist",
    }));
    if (input.clientEmail) {
      jobs.push({
        message: requestReceivedForClient({
          to: input.clientEmail,
          firstName: input.clientName.trim().split(/\s+/)[0],
          artistName: artist.data?.display_name ?? "El estudio",
          requestId: input.requestId,
        }),
        kind: "request_received_client",
        recipient: "client",
      });
    }

    for (const job of jobs) {
      const result = await sendEmail(job.message);
      const { error } = await admin.from("email_log").insert({
        workspace_id: input.workspaceId,
        request_id: input.requestId,
        kind: job.kind,
        recipient: job.recipient,
        status: result.status,
        detail: result.detail,
      });
      if (error) console.error("[emails] log", error.code);
    }
  } catch (error) {
    console.error("[emails] notifyNewRequest", error instanceof Error ? error.message : "error");
  }
}

/** Emails de owner y artistas del estudio (staff no recibe avisos de consultas). */
async function teamEmails(admin: Admin, workspaceId: string) {
  const { data } = await admin.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).in("role", ["owner", "artist"]);
  const users = await Promise.all((data ?? []).map((member) => admin.auth.admin.getUserById(member.user_id)));
  return [...new Set(users.flatMap((result) => (result.data.user?.email ? [result.data.user.email] : [])))];
}
