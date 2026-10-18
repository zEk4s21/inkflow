import { expect, test } from "@playwright/test";
import { createStudio, hasDatabase } from "./helpers";

test.describe("página pública del tatuador", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  let studio: Awaited<ReturnType<typeof createStudio>>;

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`publica-${testInfo.project.name}`, {
      works: [
        { title: "Tigre", category: "Animales" },
        { title: "Pagoda", category: "Oriental" },
        { title: "Buda", category: "Oriental" },
        { title: "Boceto sin publicar", category: "Bocetos", status: "draft" },
      ],
    });
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("muestra portada y secciones, sin trabajos en borrador", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Prueba");
    for (const title of ["Trabajos", "Contame tu idea"]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await expect(page.locator("#trabajos ul li")).toHaveCount(3);
    await expect(page.getByText("Boceto sin publicar")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("filtra el portfolio solo por categorías con trabajos publicados", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    const filters = page.getByRole("group", { name: "Filtrar trabajos por categoría" });
    await expect(filters.getByRole("button", { name: /Bocetos/ })).toHaveCount(0);
    await filters.getByRole("button", { name: /Oriental/ }).click();
    await expect(filters.getByRole("button", { name: /Oriental/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#trabajos ul li")).toHaveCount(2);
  });

  test("abre la ficha de un trabajo y vuelve", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await page.locator("#trabajos ul li a").first().click();
    await expect(page).toHaveURL(new RegExp(`/artist/${studio.slug}/work/`));
    await expect(page.getByRole("link", { name: "Quiero algo así" })).toBeVisible();
    await page.getByRole("link", { name: "← Volver a trabajos" }).click();
    await expect(page).toHaveURL(new RegExp(`/artist/${studio.slug}`));
  });

  test("un tatuador, un trabajo inexistente o un borrador devuelven 404", async ({ page }) => {
    expect((await page.goto("/artist/no-existe"))?.status()).toBe(404);
    expect((await page.goto(`/artist/${studio.slug}/work/00000000-0000-4000-8000-000000000000`))?.status()).toBe(404);
    expect((await page.goto(`/artist/${studio.slug}/work/no-es-un-uuid`))?.status()).toBe(404);
    expect((await page.goto(`/artist/${studio.slug}/work/${studio.workIds[3]}`))?.status()).toBe(404);
  });

  test("si falta una foto muestra un reemplazo en vez de una imagen rota", async ({ page }) => {
    await page.route("**/_next/image**", (route) => route.fulfill({ status: 404 }));
    await page.goto(`/artist/${studio.slug}/work/${studio.workIds[0]}`);
    await expect(page.getByText("Imagen no disponible").first()).toBeVisible();
  });
});
