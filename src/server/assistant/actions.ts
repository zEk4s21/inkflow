"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getServerEnv } from "@/server/env";
import { AIProviderError, getAiConfig, getAiProvider } from "@/server/integrations/ai";
import { getCaptchaConfig, verifyTurnstile } from "@/server/requests/captcha";
import { findOrCreateClient, isRequestRateLimited } from "@/server/requests/intake";
import { clientIp, submitterHash } from "@/server/requests/rate-limit";
import { assistantRequestSchema } from "@/server/requests/schemas";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabasePublicClient } from "@/server/supabase/public";
import { getPublicArtist } from "@/server/artists/public-artist";
import type { Brief } from "./brief";
import { ASSISTANT_LIMITS, closeConversation, createConversation, loadConversation } from "./conversation";
import type { AssistantState, ConfirmState } from "./state";
import { InvalidModelOutputError, MAX_USER_MESSAGE, runTurn } from "./turn";

const messageSchema = z.string().trim().min(1, "Escribí un mensaje.").max(MAX_USER_MESSAGE, `Hasta ${MAX_USER_MESSAGE} caracteres.`);

const UNAVAILABLE = "El asistente no está disponible ahora. Contame tu idea con el formulario.";
const FAILED = "El asistente no pudo responder. Probá de nuevo en un rato o usá el formulario.";
const LIMIT = "Llegaste al límite de mensajes de esta conversación. Revisá el resumen o empezá de nuevo.";

/**
 * Un mensaje del visitante. El historial y el resumen se leen de la base con la cookie: lo que
 * manda el navegador en `prev` solo se usa para volver a mostrar la pantalla si algo falla.
 */
export async function sendAssistantMessage(slug: string, prev: AssistantState, formData: FormData): Promise<AssistantState> {
  const raw = String(formData.get("message") ?? "");
  const fail = (error: string, remaining = prev.remaining): AssistantState => ({ ...prev, error, draft: raw, remaining, version: prev.version + 1 });

  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const message = parsed.data;

  const config = getAiConfig();
  const provider = getAiProvider();
  const captcha = getCaptchaConfig();
  if (config.status !== "configured" || !provider || captcha.mode === "missing") return fail(UNAVAILABLE);

  // Solo páginas publicadas (lectura con el rol anon).
  const [artist, { data: workspace }] = await Promise.all([
    getPublicArtist(slug),
    createSupabasePublicClient().from("workspaces").select("id").eq("slug", slug).maybeSingle(),
  ]);
  if (!artist || !workspace) return fail(UNAVAILABLE);

  const admin = createSupabaseAdminClient();
  let conversation = await loadConversation(workspace.id);
  if (!conversation) {
    const ip = clientIp(await headers());
    if (captcha.mode === "turnstile") {
      const token = String(formData.get("cf-turnstile-response") ?? "");
      if (!(await verifyTurnstile(token, captcha.secretKey, ip))) {
        return fail("No pudimos verificar que no seas un robot. Probá de nuevo.");
      }
    }
    const hash = ip ? submitterHash(ip, getServerEnv().SUPABASE_SECRET_KEY) : null;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [bySubmitter, byWorkspace] = await Promise.all([
      hash
        ? admin.from("conversations").select("id", { count: "exact", head: true }).eq("submitter_hash", hash).gte("created_at", since)
        : Promise.resolve({ count: 0, error: null }),
      admin.from("conversations").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).gte("created_at", since),
    ]);
    if (bySubmitter.error || byWorkspace.error) return fail(FAILED);
    if ((bySubmitter.count ?? 0) >= ASSISTANT_LIMITS.perSubmitter || (byWorkspace.count ?? 0) >= ASSISTANT_LIMITS.perWorkspace) {
      return fail("Se empezaron varias conversaciones seguidas. Esperá un rato o usá el formulario.");
    }
    const id = await createConversation(slug, workspace.id, hash);
    if (!id) return fail(FAILED);
    conversation = { id, status: "open", brief: {}, messageCount: 0, messages: [] };
  }
  if (conversation.status !== "open") return { ...fail("Esta consulta ya se envió. Para otra idea, empezá de nuevo."), started: true, sent: true };

  const maxMessages = config.maxMessagesPerConversation;
  if (conversation.messageCount >= maxMessages) return { ...fail(LIMIT, 0), started: true };

  if (config.monthlyTokenBudget !== null) {
    // Mes calendario en UTC; cuenta las conversaciones empezadas este mes.
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: used, error } = await admin.rpc("workspace_ai_tokens_since", { p_workspace: workspace.id, p_since: monthStart });
    if (error) return fail(FAILED);
    if (used >= config.monthlyTokenBudget) return { ...fail(UNAVAILABLE), started: true };
  }

  const record = (args: { inputTokens: number; outputTokens: number; brief?: Brief; reply?: string }) =>
    admin.rpc("record_conversation_turn", {
      p_conversation: conversation.id,
      p_max_messages: maxMessages,
      p_input_tokens: args.inputTokens,
      p_output_tokens: args.outputTokens,
      ...(args.reply ? { p_brief: args.brief, p_user_message: message, p_assistant_message: args.reply } : {}),
    });

  let turn;
  try {
    turn = await runTurn({
      provider,
      artistName: artist.artistName,
      styles: artist.styles,
      brief: conversation.brief,
      history: conversation.messages,
      userMessage: message,
    });
  } catch (error) {
    if (error instanceof InvalidModelOutputError) {
      await record(error.usage);
    } else if (error instanceof AIProviderError) {
      console.error("[assistant] provider", error.kind, error.status ?? "");
    } else {
      throw error;
    }
    return { ...fail(FAILED), started: true };
  }

  const { data: saved, error } = await record({ ...turn.usage, brief: turn.brief, reply: turn.reply });
  if (error) {
    console.error("[assistant] record turn", error.code);
    return { ...fail(FAILED), started: true };
  }
  if (!saved) return { ...fail(LIMIT, 0), started: true };

  return {
    started: true,
    sent: false,
    messages: [...conversation.messages, { role: "user", content: message }, { role: "assistant", content: turn.reply }],
    brief: turn.brief,
    ready: turn.ready,
    remaining: Math.max(0, maxMessages - conversation.messageCount - 1),
    version: prev.version + 1,
  };
}

/** Cierra la conversación actual para empezar otra. */
export async function restartAssistant(slug: string) {
  const { data: workspace } = await createSupabasePublicClient().from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (workspace) await closeConversation(slug, workspace.id);
}

/**
 * Crea la consulta con el resumen que la persona revisó y confirmó, más sus datos de contacto.
 * La conversación se marca como confirmada antes de crear nada, así un doble envío no duplica.
 */
export async function confirmAssistantRequest(slug: string, _prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  // Campo trampa invisible: si viene completo es un bot.
  if (String(formData.get("website") ?? "") !== "") return { status: "sent" };

  const field = (name: string) => String(formData.get(name) ?? "");
  const parsed = assistantRequestSchema.safeParse({
    name: field("name"),
    email: field("email"),
    phone: field("phone"),
    instagramHandle: field("instagramHandle"),
    idea: field("idea"),
    bodyZone: field("bodyZone"),
    sizeLabel: field("sizeLabel"),
    style: field("style"),
    colorMode: field("colorMode"),
    isCoverUp: field("isCoverUp"),
    details: field("details"),
    confirmed: field("confirmed"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors };
  }
  const values = parsed.data;

  if (getCaptchaConfig().mode === "missing") return { status: "error", message: UNAVAILABLE };
  const { data: workspace } = await createSupabasePublicClient().from("workspaces").select("id").eq("slug", slug).maybeSingle();
  if (!workspace) return { status: "error", message: UNAVAILABLE };
  const conversation = await loadConversation(workspace.id);
  if (!conversation) {
    return { status: "error", message: "Esta conversación ya no está disponible. Empezá de nuevo o usá el formulario." };
  }
  if (conversation.status !== "open") return { status: "sent" };

  const admin = createSupabaseAdminClient();
  const ip = clientIp(await headers());
  const hash = ip ? submitterHash(ip, getServerEnv().SUPABASE_SECRET_KEY) : null;
  const limited = await isRequestRateLimited(admin, workspace.id, hash);
  if (limited === null) return { status: "error", message: FAILED };
  if (limited) return { status: "error", message: "Recibimos varias consultas seguidas. Esperá un rato o escribí por Instagram." };

  const { data: claimed } = await admin
    .from("conversations")
    .update({ status: "confirmed" })
    .eq("id", conversation.id)
    .eq("status", "open")
    .select("id");
  if (!claimed?.length) return { status: "error", message: "Esta consulta ya se envió." };
  const release = () => admin.from("conversations").update({ status: "open" }).eq("id", conversation.id).eq("status", "confirmed");

  const clientId = await findOrCreateClient(admin, workspace.id, values);
  if (!clientId) {
    await release();
    return { status: "error", message: FAILED };
  }
  const { error } = await admin.from("tattoo_requests").insert({
    workspace_id: workspace.id,
    client_id: clientId,
    source: "assistant",
    conversation_id: conversation.id,
    idea: values.idea,
    body_zone: values.bodyZone,
    size_label: values.sizeLabel,
    style: values.style,
    color_mode: values.colorMode,
    is_cover_up: values.isCoverUp,
    details: values.details,
    submitter_hash: hash,
  });
  if (error) {
    console.error("[assistant] request insert", error.code);
    await release();
    return { status: "error", message: FAILED };
  }
  return { status: "sent" };
}
