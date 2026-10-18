import "server-only";
import type { AICompletion, AICompletionRequest, AIProvider } from "./types";

/**
 * Respuestas fijas para ver la conversación sin clave de IA. No entiende lo que se escribe: anota
 * cada mensaje en el siguiente dato que falta (idea, zona, tamaño y después otros detalles), en el
 * mismo formato JSON que se le pide al modelo real. La interfaz lo marca como simulado.
 */
const STEPS = [
  { field: "idea", max: 1000, reply: "(Respuesta simulada) Anoté tu idea. ¿En qué parte del cuerpo te la querés hacer?" },
  { field: "bodyZone", max: 60, reply: "(Respuesta simulada) Anoté la zona. ¿De qué tamaño más o menos? Por ejemplo, 15 cm." },
  { field: "sizeLabel", max: 60, reply: "(Respuesta simulada) Listo, ya tengo lo básico. Revisá el resumen y sumá cualquier otro detalle." },
] as const;
const NOTES = { field: "notes", max: 500, reply: "(Respuesta simulada) Lo sumé a otros detalles." } as const;

export function createSimulatedProvider(): AIProvider {
  return {
    name: "simulated",
    model: "respuestas fijas",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const userMessages = request.messages.filter((message) => message.role === "user");
      const step = STEPS[userMessages.length - 1] ?? NOTES;
      const content = userMessages.at(-1)?.content.trim().slice(0, step.max) ?? "";
      return {
        text: JSON.stringify({ reply: step.reply, brief: content ? { [step.field]: content } : {} }),
        // No hay modelo: no se gasta nada.
        usage: { inputTokens: 0, outputTokens: 0 },
        truncated: false,
      };
    },
  };
}
