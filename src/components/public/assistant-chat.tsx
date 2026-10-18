"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { confirmAssistantRequest, restartAssistant, sendAssistantMessage } from "@/server/assistant/actions";
import { BRIEF_FIELDS, BRIEF_LABELS, briefValue, REQUIRED_FIELDS, type Brief } from "@/server/assistant/brief";
import type { AssistantState, ChatMessage, ConfirmState } from "@/server/assistant/state";
import { AssistantConfirm } from "./assistant-confirm";
import { useTurnstile } from "./turnstile";

/** Cuando quedan estos mensajes o menos, se muestra cuántos. */
const REMAINING_WARNING = 5;

export function AssistantChat({
  slug,
  greeting,
  initialState,
  turnstileSiteKey,
  simulated,
  maxLength,
}: {
  slug: string;
  /** Primer mensaje del asistente: es fijo y no se guarda. */
  greeting: string;
  initialState: AssistantState;
  turnstileSiteKey: string | null;
  /** Respuestas fijas de prueba, sin IA: se avisa en pantalla. */
  simulated: boolean;
  maxLength: number;
}) {
  const [state, formAction, pending] = useActionState(sendAssistantMessage.bind(null, slug), initialState);
  const [confirmState, confirmAction, confirming] = useActionState(confirmAssistantRequest.bind(null, slug), { status: "idle" } as ConfirmState);
  const [reviewing, setReviewing] = useState(false);
  const [lastSent, setLastSent] = useState("");
  const captcha = useTurnstile(state.started ? null : turnstileSiteKey);
  const resetCaptcha = captcha.reset;
  const log = useRef<HTMLDivElement>(null);
  const messages: ChatMessage[] = [{ role: "assistant", content: greeting }, ...state.messages, ...(pending ? [{ role: "user" as const, content: lastSent }] : [])];

  useEffect(() => {
    if (state.error) resetCaptcha();
  }, [state, resetCaptcha]);

  // Se baja solo dentro del chat, sin mover la página.
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages.length, pending]);

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const sent = state.sent || confirmState.status === "sent";
  const blocked = state.remaining === 0 || sent;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label="Conversación" className="flex min-w-0 flex-col gap-4">
        {simulated && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
            <span className="self-start">
              <Badge tone="warning">Respuestas simuladas (prueba)</Badge>
            </span>
            <p className="text-fg-muted">No hay una IA conectada: las respuestas son fijas y solo sirven para probar la pantalla.</p>
          </div>
        )}

        <div ref={log} role="log" aria-live="polite" aria-label="Mensajes" className="flex max-h-[60svh] min-h-64 flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-surface-1/40 p-4">
          {messages.map((message, index) => (
            <p
              key={index}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                message.role === "user" ? "self-end bg-accent/15 text-fg" : "self-start bg-surface-2 text-fg",
              )}
            >
              <span className="sr-only">{message.role === "user" ? "Vos: " : "Asistente: "}</span>
              {message.content}
            </p>
          ))}
          {pending && (
            <p className="self-start px-4 text-sm text-fg-subtle" aria-live="off">
              Escribiendo…
            </p>
          )}
        </div>

        {sent ? (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-success/40 bg-success/5 p-5">
            <h2 className="font-medium">¡Listo! Recibí tu consulta</h2>
            <p className="text-sm leading-relaxed text-fg-muted">
              La voy a leer con el resumen de esta charla y te respondo por el medio de contacto que dejaste. Todavía no hay nada reservado.
            </p>
          </div>
        ) : (
          <form action={formAction} onSubmit={(event) => setLastSent(String(new FormData(event.currentTarget).get("message") ?? "").trim())} className="flex flex-col gap-3">
            <TextAreaField
              key={state.version}
              label="Tu mensaje"
              name="message"
              defaultValue={state.draft ?? ""}
              maxLength={maxLength}
              required
              disabled={blocked}
              onKeyDown={submitOnEnter}
              placeholder="Por ejemplo: una golondrina con una rosa, en el antebrazo"
              hint="Enter para enviar, Shift + Enter para bajar de línea. No hace falta que dejes tus datos acá."
              className="min-h-24"
            />
            {captcha.widget}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={pending} disabled={blocked || (captcha.required && !captcha.token)}>
                Enviar
              </Button>
              {state.remaining <= REMAINING_WARNING && !blocked && (
                <span className="text-xs text-fg-subtle">
                  {state.remaining === 1 ? "Te queda 1 mensaje" : `Te quedan ${state.remaining} mensajes`}
                </span>
              )}
            </div>
            {state.error && (
              <p role="alert" className="text-sm text-danger">
                {state.error}
              </p>
            )}
          </form>
        )}

        {state.started && (
          <form action={restartAssistant.bind(null, slug)}>
            <Button type="submit" variant="ghost" size="sm">
              Empezar de nuevo
            </Button>
          </form>
        )}
      </section>

      {reviewing && state.ready && !sent ? (
        <AssistantConfirm
          key={JSON.stringify(state.brief)}
          brief={state.brief}
          state={confirmState}
          action={confirmAction}
          pending={confirming}
          onBack={() => setReviewing(false)}
        />
      ) : (
        <BriefPanel brief={state.brief} ready={state.ready} sent={sent} onReview={() => setReviewing(true)} />
      )}
    </div>
  );
}

function BriefPanel({ brief, ready, sent, onReview }: { brief: Brief; ready: boolean; sent: boolean; onReview: () => void }) {
  return (
    <aside aria-label="Resumen de tu idea" className="flex flex-col gap-4 self-start rounded-lg border border-line bg-surface-1 p-6 lg:sticky lg:top-24">
      <h2 className="font-medium">Resumen de tu idea</h2>
      <dl className="flex flex-col divide-y divide-line text-sm">
        {BRIEF_FIELDS.map((field) => {
          const value = briefValue(brief, field);
          return (
            <div key={field} className="flex flex-col gap-1 py-3">
              <dt className="text-fg-subtle">{BRIEF_LABELS[field]}</dt>
              <dd className={cn("break-words", value ? "text-fg" : "text-fg-subtle")}>
                {value ?? (REQUIRED_FIELDS.includes(field) ? "Falta" : "—")}
              </dd>
            </div>
          );
        })}
      </dl>
      {sent ? (
        <p className="text-xs text-fg-subtle">Este resumen ya se envió con tu consulta.</p>
      ) : ready ? (
        <div role="status" className="flex flex-col gap-3 text-sm">
          <p className="text-fg-muted">Ya está lo básico. Revisalo, dejá cómo responderte y enviá la consulta.</p>
          <Button type="button" size="sm" onClick={onReview} className="self-start">
            Revisar y enviar
          </Button>
        </div>
      ) : (
        <p className="text-xs text-fg-subtle">Se completa solo a medida que charlamos. Lo mínimo: idea, zona y tamaño.</p>
      )}
    </aside>
  );
}
