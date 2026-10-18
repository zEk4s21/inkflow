/**
 * Contrato común de los proveedores de IA. El resto de la app habla con esta interfaz y nunca
 * con un SDK concreto, así el proveedor se cambia por variables de entorno.
 *
 * El modelo solo devuelve texto: no tiene herramientas ni escribe en la base (ver SECURITY.md).
 */

export type AIMessage = { role: "user" | "assistant"; content: string };

export type AICompletionRequest = {
  /** Instrucciones fijas del servidor. Nunca incluyen texto del cliente sin delimitar. */
  system: string;
  messages: AIMessage[];
  maxTokens: number;
  signal?: AbortSignal;
};

export type AICompletion = {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  /** El modelo cortó por el tope de tokens: la respuesta puede estar incompleta. */
  truncated: boolean;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  complete(request: AICompletionRequest): Promise<AICompletion>;
}

export type AIErrorKind = "auth" | "rate_limit" | "unavailable" | "bad_request" | "bad_response";

/** Error del proveedor sin datos sensibles: el mensaje nunca incluye la clave ni el texto enviado. */
export class AIProviderError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
