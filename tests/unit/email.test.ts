import { describe, expect, it, vi } from "vitest";
import { newRequestForArtist, requestReceivedForClient } from "@/server/notifications/templates";

vi.mock("server-only", () => ({}));

const { getEmailConfig, getEmailStatus, sendEmail } = await import("@/server/integrations/email");

const configured = { EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "re_prueba_no_real", EMAIL_FROM: "Esti <hola@example.com>" };
const message = { to: "ana@example.com", subject: "Hola", text: "Texto", html: "<p>Texto</p>", idempotencyKey: "k-1" };

describe("configuración de email", () => {
  it("sin clave ni remitente queda como no configurado", () => {
    expect(getEmailConfig({})).toEqual({ status: "missing", missing: ["EMAIL_API_KEY", "EMAIL_FROM"] });
  });

  it("rechaza proveedor desconocido y remitente mal escrito", () => {
    const config = getEmailConfig({ ...configured, EMAIL_PROVIDER: "otro", EMAIL_FROM: "no es un email" });
    expect(config.status).toBe("invalid");
    expect(config.status === "invalid" && config.problems).toHaveLength(2);
  });

  it("el estado para el panel nunca incluye la clave", () => {
    const status = getEmailStatus(configured);
    expect(status).toEqual({ status: "configured", providerLabel: "Resend", from: "Esti <hola@example.com>" });
    expect(JSON.stringify(status)).not.toContain("re_prueba_no_real");
  });
});

describe("envío", () => {
  it("sin configuración no llama a nadie y lo dice", async () => {
    const fetcher = vi.fn();
    expect(await sendEmail(message, {}, fetcher)).toEqual({ status: "skipped", detail: "email no configurado" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("con Resend manda POST /emails con la clave en el header y la clave de idempotencia", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: "abc-123" }), { status: 200 }));
    expect(await sendEmail(message, configured, fetcher)).toEqual({ status: "sent", detail: "abc-123" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_prueba_no_real");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBe("k-1");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: "Esti <hola@example.com>", to: ["ana@example.com"], subject: "Hola" });
  });

  it("un error del proveedor o de red queda como fallido, sin la clave en el detalle", async () => {
    const rejected = await sendEmail(message, configured, vi.fn(async () => new Response("{}", { status: 401 })));
    expect(rejected).toEqual({ status: "failed", detail: "el proveedor respondió 401" });
    const offline = await sendEmail(message, configured, vi.fn(async () => Promise.reject(new Error("re_prueba_no_real"))));
    expect(offline).toEqual({ status: "failed", detail: "sin conexión con el proveedor" });
  });
});

describe("plantillas", () => {
  it("el aviso al tatuador lleva solo el nombre y el link, escapados", () => {
    const email = newRequestForArtist({ to: "esti@example.com", clientName: "Ana <b>", source: "form", panelUrl: "https://inkflow.test/panel/solicitudes/1", requestId: "1" });
    expect(email.subject).toBe("Nueva consulta de Ana <b>");
    expect(email.html).toContain("Ana &lt;b&gt;");
    expect(email.html).not.toContain("<b>");
    expect(email.text).toContain("https://inkflow.test/panel/solicitudes/1");
  });

  it("la confirmación al cliente aclara que no hay nada reservado", () => {
    const email = requestReceivedForClient({ to: "ana@example.com", firstName: "Ana", artistName: "Esti", requestId: "1" });
    expect(email.subject).toBe("Esti: recibí tu consulta");
    expect(email.text).toContain("Todavía no hay nada reservado");
    expect(email.idempotencyKey).toBe("request-received-client/1");
  });
});
