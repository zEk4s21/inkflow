import { expect, test } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn } from "./helpers";

test.describe("link para el cliente", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  test("el cliente ve estado, presupuesto y turno, pero no lo interno; el link se reemplaza y se desactiva", async ({ page, browser }, testInfo) => {
    const studio = await createStudio(`link-${testInfo.project.name}`, { role: "owner" });
    try {
      const admin = adminClient();
      const { data: client } = await admin
        .from("clients")
        .insert({ workspace_id: studio.workspaceId, name: "Valentina Sosa", phone: "5491155551234" })
        .select("id")
        .single()
        .throwOnError();
      const { data: request } = await admin
        .from("tattoo_requests")
        .insert({ workspace_id: studio.workspaceId, client_id: client.id, idea: "Un colibrí en la clavícula.", body_zone: "Clavícula" })
        .select("id")
        .single()
        .throwOnError();
      await admin
        .from("quotes")
        .insert({ workspace_id: studio.workspaceId, request_id: request.id, amount: 90000, deposit: 20000, currency: "ARS", status: "sent", message: "Incluye diseño." })
        .throwOnError();
      const { data: artist } = await admin.from("artist_profiles").select("id").eq("workspace_id", studio.workspaceId).single().throwOnError();
      await admin
        .from("appointments")
        .insert({
          workspace_id: studio.workspaceId,
          artist_id: artist.id,
          client_id: client.id,
          request_id: request.id,
          period: "[2030-03-04T13:00:00Z,2030-03-04T16:00:00Z)",
          status: "confirmed",
        })
        .throwOnError();
      await admin
        .from("payments")
        .insert({ workspace_id: studio.workspaceId, request_id: request.id, amount: 25000, currency: "ARS", kind: "deposit", method: "transfer", paid_on: "2026-10-01", note: "Op. privada" })
        .throwOnError();
      await admin.from("request_notes").insert({ workspace_id: studio.workspaceId, request_id: request.id, body: "Nota interna secreta", author_id: studio.userId! }).throwOnError();

      await signIn(page, studio.email);
      await page.goto(`/panel/solicitudes/${request.id}`);
      const card = page.getByRole("region", { name: "Link para el cliente" });
      await card.getByRole("button", { name: "Generar link" }).click();
      const field = card.getByRole("textbox", { name: "Link para el cliente" });
      await expect(field).toHaveValue(/\/seguimiento\/[A-Za-z0-9_-]{43}$/);
      const first = new URL(await field.inputValue()).pathname;
      await expect(card.getByRole("link", { name: "Mandar por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491155551234\?text=/);

      const visitor = await browser.newContext();
      const tracking = await visitor.newPage();
      const response = await tracking.goto(first);
      expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
      expect(response?.headers()["x-robots-tag"]).toContain("noindex");
      await expect(tracking.getByRole("heading", { name: "Hola, Valentina" })).toBeVisible();
      await expect(tracking.getByRole("region", { name: "Estado" }).getByText("Presupuesto enviado")).toBeVisible();
      const quote = tracking.getByRole("region", { name: "Presupuesto" });
      await expect(quote.getByText(/90\.000/)).toBeVisible();
      await expect(quote.getByText(/20\.000/)).toBeVisible();
      await expect(quote.getByText("Incluye diseño.")).toBeVisible();
      await expect(quote.getByRole("definition").filter({ hasText: "65.000" })).toBeVisible();
      await expect(tracking.getByText("Op. privada")).toHaveCount(0);
      const appointments = tracking.getByRole("region", { name: "Turnos" });
      await expect(appointments.getByText(/lunes, 4 de marzo, 10:00 a 13:00/i)).toBeVisible();
      await expect(appointments.getByText("Confirmado")).toBeVisible();
      await expect(tracking.getByText("Un colibrí en la clavícula.")).toBeVisible();
      await expect(tracking.getByText("Nota interna secreta")).toHaveCount(0);
      await expect(tracking.getByText("5491155551234")).toHaveCount(0);

      // Al generar otro, el anterior deja de andar.
      await page.reload();
      await expect(card.getByText(/Hay un link activo desde el/)).toBeVisible();
      await card.getByRole("button", { name: "Generar uno nuevo" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Generar" }).click();
      await expect(field).toHaveValue(/\/seguimiento\//);
      const second = new URL(await field.inputValue()).pathname;
      expect(second).not.toBe(first);
      await tracking.goto(first);
      await expect(tracking.getByRole("heading", { name: "Link no disponible" })).toBeVisible();
      await tracking.goto(second);
      await expect(tracking.getByRole("heading", { name: "Hola, Valentina" })).toBeVisible();

      await card.getByRole("button", { name: "Desactivar" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Desactivar" }).click();
      await expect(card.getByRole("button", { name: "Generar link" })).toBeVisible();
      await tracking.goto(second);
      await expect(tracking.getByRole("heading", { name: "Link no disponible" })).toBeVisible();
      await visitor.close();
    } finally {
      await studio.cleanup();
    }
  });

  test("un token inventado muestra el aviso, sin datos", async ({ page }) => {
    for (const token of ["a".repeat(43), "corto"]) {
      await page.goto(`/seguimiento/${token}`);
      await expect(page.getByRole("heading", { name: "Link no disponible" })).toBeVisible();
      await expect(page.getByRole("region")).toHaveCount(0);
    }
  });
});
