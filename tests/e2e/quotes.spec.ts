import { expect, test } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn } from "./helpers";

async function seedRequest(workspaceId: string, name: string) {
  const admin = adminClient();
  const { data: client } = await admin
    .from("clients")
    .insert({ workspace_id: workspaceId, name, email: `${name.split(" ")[0].toLowerCase()}-${Date.now()}@example.com` })
    .select("id")
    .single()
    .throwOnError();
  const { data } = await admin
    .from("tattoo_requests")
    .insert({ workspace_id: workspaceId, client_id: client.id, idea: "Una golondrina con una rosa en el antebrazo." })
    .select("id")
    .single()
    .throwOnError();
  return { requestId: data.id, clientId: client.id };
}

test.describe("presupuestos", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  test("se arma, se envía y se acepta; la solicitud acompaña", async ({ page }, testInfo) => {
    const studio = await createStudio(`presu-${testInfo.project.name}`, { role: "owner" });
    try {
      const { requestId, clientId } = await seedRequest(studio.workspaceId, "Lucía Paz");
      await signIn(page, studio.email);
      await page.goto(`/panel/solicitudes/${requestId}`);
      const card = page.getByRole("region", { name: "Presupuesto", exact: true });
      await expect(card.getByText("Todavía no tiene presupuesto.")).toBeVisible();

      await card.getByRole("button", { name: "Armar presupuesto" }).click();
      const form = card.getByRole("form", { name: "Presupuesto" });
      await form.getByRole("textbox", { name: /Total/ }).fill("120.000");
      await form.getByRole("textbox", { name: "Seña" }).fill("200.000");
      await form.getByRole("button", { name: "Guardar borrador" }).click();
      await expect(form.getByText("La seña no puede ser mayor que el total.")).toBeVisible();

      await form.getByRole("textbox", { name: "Seña" }).fill("30.000");
      await form.getByRole("spinbutton", { name: "Sesiones estimadas" }).fill("2");
      await form.getByRole("textbox", { name: "Mensaje para el cliente" }).fill("Incluye el diseño y un retoque.");
      await form.getByRole("button", { name: "Guardar y marcar enviado" }).click();

      await expect(card.getByText("Enviado", { exact: true })).toBeVisible();
      await expect(card.getByText(/120\.000/)).toBeVisible();
      await expect(card.getByText(/30\.000/)).toBeVisible();
      await expect(card.getByText("Incluye el diseño y un retoque.")).toBeVisible();
      await expect(card.getByRole("button", { name: "Armar presupuesto" })).toHaveCount(0);
      await expect(page.getByText("Presupuestada").first()).toBeVisible();

      await card.getByRole("button", { name: "Aceptó" }).click();
      await expect(card.getByText("Aceptado", { exact: true })).toBeVisible();
      await expect(page.getByText("Aceptada").first()).toBeVisible();
      // Cerrado: sin acciones, y se puede armar otro si hace falta.
      await expect(card.getByRole("button", { name: "Aceptó" })).toHaveCount(0);
      await expect(card.getByRole("button", { name: "Armar presupuesto" })).toBeVisible();

      await page.goto(`/panel/clientes/${clientId}`);
      const quotes = page.getByRole("region", { name: "Presupuestos (1)" });
      await expect(quotes.getByText(/120\.000/)).toBeVisible();
      await expect(quotes.getByText("Aceptado", { exact: true })).toBeVisible();
    } finally {
      await studio.cleanup();
    }
  });

  test("un borrador se edita y se retira", async ({ page }, testInfo) => {
    const studio = await createStudio(`presu-ed-${testInfo.project.name}`, { role: "owner" });
    try {
      const { requestId } = await seedRequest(studio.workspaceId, "Tomás Gil");
      await signIn(page, studio.email);
      await page.goto(`/panel/solicitudes/${requestId}`);
      const card = page.getByRole("region", { name: "Presupuesto", exact: true });
      await card.getByRole("button", { name: "Armar presupuesto" }).click();
      await card.getByRole("textbox", { name: /Total/ }).fill("80000");
      await card.getByRole("button", { name: "Guardar borrador" }).click();
      await expect(card.getByText("Borrador", { exact: true })).toBeVisible();

      await card.getByRole("button", { name: "Editar" }).click();
      await card.getByRole("textbox", { name: /Total/ }).fill("95.000");
      await card.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(card.getByText(/95\.000/)).toBeVisible();

      await card.getByRole("button", { name: "Retirar" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Retirar" }).click();
      await expect(card.getByText("Retirado", { exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: "Armar presupuesto" })).toBeVisible();
    } finally {
      await studio.cleanup();
    }
  });

  test("staff ve el presupuesto pero no lo puede tocar", async ({ page }, testInfo) => {
    const studio = await createStudio(`presu-st-${testInfo.project.name}`, { role: "staff" });
    try {
      const { requestId } = await seedRequest(studio.workspaceId, "Sofía Luna");
      await adminClient()
        .from("quotes")
        .insert({ workspace_id: studio.workspaceId, request_id: requestId, amount: 50000, currency: "ARS", status: "sent" })
        .throwOnError();
      await signIn(page, studio.email);
      await page.goto(`/panel/solicitudes/${requestId}`);
      const card = page.getByRole("region", { name: "Presupuesto", exact: true });
      await expect(card.getByText("Enviado", { exact: true })).toBeVisible();
      await expect(card.getByRole("button")).toHaveCount(0);
    } finally {
      await studio.cleanup();
    }
  });
});
