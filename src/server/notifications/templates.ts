import type { EmailMessage } from "@/server/integrations/email/types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Texto plano + el mismo contenido en HTML mínimo, con todo lo que viene de usuarios escapado. */
function render(paragraphs: string[], link?: { href: string; label: string }) {
  const text = [...paragraphs, ...(link ? [`${link.label}: ${link.href}`] : [])].join("\n\n");
  const html = [
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...(link ? [`<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>`] : []),
  ].join("\n");
  return { text, html };
}

const SOURCE: Record<string, string> = { form: "desde el formulario", assistant: "desde el asistente" };

/**
 * Aviso al tatuador. Lleva solo el nombre y el link al panel: la idea y los datos de contacto se
 * leen ahí, con sesión, y no pasan por el proveedor de email.
 */
export function newRequestForArtist(input: { to: string; clientName: string; source: string; panelUrl: string; requestId: string }): EmailMessage {
  return {
    to: input.to,
    subject: `Nueva consulta de ${input.clientName}`,
    ...render([`Te llegó una consulta ${SOURCE[input.source] ?? ""} de ${input.clientName}.`.replace("  ", " "), "La ves completa en tu panel de INKFLOW."], {
      href: input.panelUrl,
      label: "Abrir la consulta",
    }),
    idempotencyKey: `new-request-artist/${input.requestId}/${input.to}`,
  };
}

/** Confirmación al cliente: que llegó y que todavía no hay nada reservado. */
export function requestReceivedForClient(input: { to: string; firstName: string; artistName: string; requestId: string }): EmailMessage {
  return {
    to: input.to,
    subject: `${input.artistName}: recibí tu consulta`,
    ...render([
      `Hola, ${input.firstName}.`,
      "Recibí tu consulta. La voy a leer y te respondo por el medio de contacto que dejaste.",
      "Todavía no hay nada reservado: el turno se confirma cuando lo coordinemos.",
      input.artistName,
    ]),
    idempotencyKey: `request-received-client/${input.requestId}`,
  };
}
