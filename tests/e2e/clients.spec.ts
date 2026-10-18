import { expect, test } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn } from "./helpers";

test.describe("clientes en el panel", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  let studio: Awaited<ReturnType<typeof createStudio>>;
  const ids = { byEmail: "", byPhone: "", request: "" };

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`clientes-${testInfo.project.name}`, { role: "owner" });
    const admin = adminClient();
    const { data: byEmail } = await admin
      .from("clients")
      .insert({ workspace_id: studio.workspaceId, name: "Sofía Ruiz", email: "sofia@example.com" })
      .select("id")
      .single()
      .throwOnError();
    const { data: byPhone } = await admin
      .from("clients")
      .insert({ workspace_id: studio.workspaceId, name: "Sofi", phone: "5491155556666" })
      .select("id")
      .single()
      .throwOnError();
    const { data: request } = await admin
      .from("tattoo_requests")
      .insert([
        { workspace_id: studio.workspaceId, client_id: byEmail.id, idea: "Un dragón en la pantorrilla" },
        { workspace_id: studio.workspaceId, client_id: byPhone.id, idea: "Retoque del dragón por WhatsApp" },
      ])
      .select("id")
      .throwOnError();
    Object.assign(ids, { byEmail: byEmail.id, byPhone: byPhone.id, request: request[0].id });
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("edita un cliente, avisa si el WhatsApp ya es de otro y une los duplicados", async ({ page }) => {
    await signIn(page, studio.email);
    await page.goto(`/panel/solicitudes/${ids.request}`);
    await page.getByRole("link", { name: "Ver ficha" }).click();
    await expect(page).toHaveURL(new RegExp(`/panel/clientes/${ids.byEmail}$`));

    const field = (name: string) => page.getByRole("textbox", { name, exact: true });
    await field("Nombre").fill("Sofía Ruiz Díaz");
    await field("Instagram").fill("@sofi.ruiz");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sofía Ruiz Díaz");

    // El WhatsApp de "Sofi" ya existe: no se guarda y sugiere unirlos.
    await field("WhatsApp").fill("+54 9 11 5555-6666");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.getByText(/Ya hay otro cliente con ese WhatsApp/)).toBeVisible();
    await field("WhatsApp").fill("");

    await page.getByRole("combobox", { name: "Cliente repetido" }).selectOption(ids.byPhone);
    await page.getByRole("button", { name: "Unir a esta ficha" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Unir" }).click();
    await expect(page.getByRole("heading", { name: "Solicitudes (2)" })).toBeVisible();
    await expect(page.getByText("Retoque del dragón por WhatsApp")).toBeVisible();
    await expect(field("WhatsApp")).toHaveValue("5491155556666");

    await page.reload();
    await expect(field("WhatsApp")).toHaveValue("5491155556666");
    await expect(field("Instagram")).toHaveValue("sofi.ruiz");

    await page.goto("/panel/clientes");
    await expect(page.locator("main ul li")).toHaveCount(1);
    await expect(page.getByText("2 solicitudes")).toBeVisible();
  });
});
