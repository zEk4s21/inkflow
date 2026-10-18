import { isBriefReady, type Brief } from "./brief";
import type { StoredConversation } from "./conversation";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AssistantState = {
  /** Ya hay conversación: no se vuelve a pedir el captcha. */
  started: boolean;
  /** Ya se mandó la consulta de esta conversación. */
  sent: boolean;
  messages: ChatMessage[];
  brief: Brief;
  ready: boolean;
  /** Mensajes que le quedan a la persona en esta conversación. */
  remaining: number;
  error?: string;
  /** Lo que escribió, para no perderlo si el envío falló. */
  draft?: string;
  /** Cambia en cada respuesta: la caja de texto se vuelve a armar con `draft`. */
  version: number;
};

export function toAssistantState(conversation: StoredConversation | null, maxMessages: number): AssistantState {
  return {
    started: conversation !== null,
    sent: conversation?.status === "confirmed",
    messages: conversation?.messages ?? [],
    brief: conversation?.brief ?? {},
    ready: conversation ? isBriefReady(conversation.brief) : false,
    remaining: Math.max(0, maxMessages - (conversation?.messageCount ?? 0)),
    version: 0,
  };
}

export type ConfirmState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };
