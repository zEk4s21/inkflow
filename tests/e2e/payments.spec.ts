import { expect, test } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn } from "./helpers";

test.describe("pagos", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  test("se registra la seña, se ve el saldo y se anula un pago mal cargado", async ({ page }, testInfo) => {
    const studio = await createStudio(`pagos-${testInfo.project.name}`, { role: "owner" });
    try {
      const admin = adminClient();
      const { data: client } = await admin
        .from("clients")
        .insert({ workspace_id: studio.workspaceId, name: "Julián Ríos", email: `julian-${Date.now()}@example.com` })
        .select("id")
        .single()
        .throwOnError();
      const { data: request } = await admin
        .from("tattoo_requests")
        .insert({ workspace_id: studio.workspaceId, client_id: client.id, idea: "Un lobo en el omóplato, realismo." })
        .select("id")
        .single()
        .throwOnError();
      await admin
        .from("quotes")
        .insert({ workspace_id: studio.workspaceId, request_id: request.id, amount: 150000, deposit: 30000, currency: "ARS", status: "sent" })
        .throwOnError();

      await signIn(page, studio.email);
      await page.goto(`/panel/solicitudes/${request.id}`);
      const card = page.getByRole("region", { name: "Pagos", exact: true });
      await expect(card.getByText("Contra el presupuesto enviado de $ 150.000,00.")).toBeVisible();

      await card.getByRole("button", { name: "Registrar pago" }).click();
      const form = card.getByRole("form", { name: "Registrar pago" });
      await expect(form.getByRole("combobox", { name: "Tipo" })).toHaveValue("deposit");
      await form.getByRole("textbox", { name: /Monto/ }).fill("30.000");
      await form.getByRole("textbox", { name: "Nota" }).fill("Op. 12345");
      await form.getByRole("button", { name: "Guardar pago" }).click();
      await expect(card.getByText("Op. 12345")).toBeVisible();

      // Un pago con error de tipeo: se anula y deja de sumar.
      await card.getByRole("button", { name: "Registrar pago" }).click();
      await expect(form.getByRole("combobox", { name: "Tipo" })).toHaveValue("payment");
      await form.getByRole("textbox", { name: /Monto/ }).fill("300.000");
      await form.getByRole("combobox", { name: "Medio" }).selectOption("cash");
      await form.getByRole("button", { name: "Guardar pago" }).click();
      await expect(card.getByText("Cobrado de más")).toBeVisible();

      await card.getByRole("button", { name: "Anular Pago de $ 300.000,00" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Anular" }).click();
      await expect(card.getByText("Anulado")).toBeVisible();
      await expect(card.getByText("Saldo")).toBeVisible();
      await expect(card.getByRole("definition").filter({ hasText: "120.000" })).toBeVisible();

      await page.goto(`/panel/clientes/${client.id}`);
      await expect(page.getByRole("region", { name: "Pagos" }).getByText(/Cobrado en total: \$\s30\.000,00/)).toBeVisible();
    } finally {
      await studio.cleanup();
    }
  });

  test("staff ve los pagos pero no los toca", async ({ page }, testInfo) => {
    const studio = await createStudio(`pagos-st-${testInfo.project.name}`, { role: "staff" });
    try {
      const admin = adminClient();
      const { data: client } = await admin
        .from("clients")
        .insert({ workspace_id: studio.workspaceId, name: "Mora Paz", email: `mora-${Date.now()}@example.com` })
        .select("id")
        .single()
        .throwOnError();
      const { data: request } = await admin
        .from("tattoo_requests")
        .insert({ workspace_id: studio.workspaceId, client_id: client.id, idea: "Una luna en la muñeca, fina." })
        .select("id")
        .single()
        .throwOnError();
      await admin
        .from("payments")
        .insert({ workspace_id: studio.workspaceId, request_id: request.id, amount: 10000, currency: "ARS", kind: "deposit", method: "cash", paid_on: "2026-10-01" })
        .throwOnError();
      await signIn(page, studio.email);
      await page.goto(`/panel/solicitudes/${request.id}`);
      const card = page.getByRole("region", { name: "Pagos", exact: true });
      await expect(card.getByText("Efectivo", { exact: false })).toBeVisible();
      await expect(card.getByRole("button")).toHaveCount(0);
    } finally {
      await studio.cleanup();
    }
  });
});
