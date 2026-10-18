import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/config/env";
import type { AIMessage } from "@/server/integrations/ai";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { readBrief, type Brief } from "./brief";

/** Cuánto dura una conversación (igual que expires_at en la base). */
const CONVERSATION_DAYS = 7;
const COOKIE = "inkflow_assistant";
/** Mensajes que se cargan para mostrar y para mandarle al modelo. */
const MESSAGES_LIMIT = 80;

export type StoredConversation = {
  id: string;
  brief: Brief;
  /** Mensajes que mandó la persona. */
  messageCount: number;
  messages: AIMessage[];
};

/** La cookie vale solo para la página del asistente de ese estudio. */
const cookiePath = (slug: string) => `/artist/${slug}/assistant`;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Conversación abierta y vigente de la cookie, para ese estudio. Si no hay, null. */
export async function loadConversation(workspaceId: string): Promise<StoredConversation | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const admin = createSupabaseAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id, brief, message_count")
    .eq("token_hash", hashToken(token))
    .eq("workspace_id", workspaceId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!conversation) return null;

  const { data: messages, error } = await admin
    .from("conversation_messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_LIMIT);
  if (error) throw new Error("No se pudieron leer los mensajes de la conversación.");

  return {
    id: conversation.id,
    brief: readBrief(conversation.brief),
    messageCount: conversation.message_count,
    messages: messages.reverse().map((message) => ({ role: message.role as AIMessage["role"], content: message.content })),
  };
}

/** Crea la conversación y deja el token en una cookie httpOnly. En la base queda solo su hash. */
export async function createConversation(slug: string, workspaceId: string, submitterHash: string | null): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await createSupabaseAdminClient()
    .from("conversations")
    .insert({ workspace_id: workspaceId, token_hash: hashToken(token), submitter_hash: submitterHash })
    .select("id")
    .single();
  if (error) {
    console.error("[assistant] conversation insert", error.code);
    return null;
  }
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getPublicEnv().NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    path: cookiePath(slug),
    maxAge: CONVERSATION_DAYS * 86_400,
  });
  return data.id;
}

/** Cierra la conversación de la cookie (si hay) y borra la cookie. */
export async function closeConversation(slug: string, workspaceId: string) {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await createSupabaseAdminClient()
      .from("conversations")
      .update({ status: "closed" })
      .eq("token_hash", hashToken(token))
      .eq("workspace_id", workspaceId)
      .eq("status", "open");
  }
  store.delete({ name: COOKIE, path: cookiePath(slug) });
}

/** Conversaciones nuevas por hora: por persona (IP) y por estudio. */
export const ASSISTANT_LIMITS = { perSubmitter: 5, perWorkspace: 60 } as const;
