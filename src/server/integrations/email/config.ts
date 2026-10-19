import "server-only";

/** Proveedores con adaptador. Sumar uno es escribir su adaptador y agregarlo acá. */
export const EMAIL_PROVIDERS = ["resend"] as const;
export type EmailProviderName = (typeof EMAIL_PROVIDERS)[number];

export const EMAIL_PROVIDER_LABELS: Record<EmailProviderName, string> = {
  resend: "Resend",
};

export type EmailConfig =
  | { status: "configured"; provider: EmailProviderName; apiKey: string; from: string }
  /** Sin variables: no se manda nada y el panel lo muestra como "no configurado". */
  | { status: "missing"; missing: string[] }
  | { status: "invalid"; problems: string[] };

// "Nombre <hola@dominio.com>" o "hola@dominio.com".
const FROM_PATTERN = /^(?:[^<>\r\n]{1,80} <[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

/** Lee la configuración de email de las variables de entorno. Solo servidor: la clave nunca sale de acá. */
export function getEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  const provider = env.EMAIL_PROVIDER?.trim() || "resend";
  const apiKey = env.EMAIL_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();

  const missing = [!apiKey && "EMAIL_API_KEY", !from && "EMAIL_FROM"].filter((name): name is string => Boolean(name));
  if (missing.length > 0) return { status: "missing", missing };

  const problems: string[] = [];
  if (!(EMAIL_PROVIDERS as readonly string[]).includes(provider)) {
    problems.push(`EMAIL_PROVIDER="${provider}" no está soportado (opciones: ${EMAIL_PROVIDERS.join(", ")}).`);
  }
  if (!FROM_PATTERN.test(from!)) problems.push('EMAIL_FROM tiene que ser "Nombre <direccion@dominio>" o una dirección.');
  if (problems.length > 0) return { status: "invalid", problems };

  return { status: "configured", provider: provider as EmailProviderName, apiKey: apiKey!, from: from! };
}

/** Lo que se puede mostrar en el panel: nunca la clave. */
export type EmailStatus =
  | { status: "configured"; providerLabel: string; from: string }
  | { status: "missing"; missing: string[] }
  | { status: "invalid"; problems: string[] };

export function getEmailStatus(env?: Record<string, string | undefined>): EmailStatus {
  const config = getEmailConfig(env);
  if (config.status !== "configured") return config;
  return { status: "configured", providerLabel: EMAIL_PROVIDER_LABELS[config.provider], from: config.from };
}
