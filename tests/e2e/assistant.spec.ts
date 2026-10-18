import { expect, test } from "@playwright/test";
import { createStudio, hasDatabase, signIn } from "./helpers";

// Local y CI corren sin AI_API_KEY ni AI_MODEL: este es el estado "no configurado".
test.describe("Ink Assistant sin configurar", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  let studio: Awaited<ReturnType<typeof createStudio>>;

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`asistente-${testInfo.project.name}`, { role: "owner" });
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("la página pública lo indica y manda al formulario", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await expect(page.getByRole("heading", { name: "¿Tenés referencias?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Armar mi idea con el asistente" })).toHaveCount(0);
    await page.goto(`/artist/${studio.slug}/assistant`);
    await expect(page.getByRole("status")).toContainText("El asistente no está disponible por ahora");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.getByRole("link", { name: "Ir al formulario" }).click();
    await expect(page).toHaveURL(new RegExp(`/artist/${studio.slug}#contacto$`));
    await expect(page.getByRole("textbox", { name: "Tu idea", exact: true })).toBeVisible();
  });

  test("el panel dice qué variables faltan, sin mostrar claves", async ({ page }) => {
    await signIn(page, studio.email);
    await page.goto("/panel/ajustes");
    const card = page.getByRole("region", { name: "Ink Assistant" });
    await expect(card.getByText("No configurado")).toBeVisible();
    await expect(card.getByText("AI_API_KEY")).toBeVisible();
    await expect(card.getByText("AI_MODEL")).toBeVisible();
  });
});
