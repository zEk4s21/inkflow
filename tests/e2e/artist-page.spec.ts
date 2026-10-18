import { expect, test } from "@playwright/test";

test.describe("página pública del tatuador", () => {
  test("muestra portada, secciones y aviso de contenido demo", async ({ page }) => {
    await page.goto("/artist/esti");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Esti");
    await expect(page.getByRole("note")).toContainText("los trabajos son de ejemplo");
    for (const title of ["Trabajos", "El proceso", "Preguntas frecuentes", "Contame tu idea"]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("filtra el portfolio solo por categorías con trabajos", async ({ page }) => {
    await page.goto("/artist/esti");
    const filters = page.getByRole("group", { name: "Filtrar trabajos por categoría" });
    const grid = page.locator("#trabajos ul");
    const total = await grid.locator("li").count();
    await filters.getByRole("button", { name: /Oriental/ }).click();
    await expect(filters.getByRole("button", { name: /Oriental/ })).toHaveAttribute("aria-pressed", "true");
    const filtered = await grid.locator("li").count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
  });

  test("abre la ficha de un trabajo y vuelve", async ({ page }) => {
    await page.goto("/artist/esti");
    await page.locator("#trabajos ul li a").first().click();
    await expect(page).toHaveURL(/\/artist\/esti\/work\//);
    await expect(page.getByRole("link", { name: "Quiero algo así" })).toBeVisible();
    await page.getByRole("link", { name: "← Volver a trabajos" }).click();
    await expect(page).toHaveURL(/\/artist\/esti/);
  });

  test("un tatuador o trabajo inexistente devuelve 404", async ({ page }) => {
    expect((await page.goto("/artist/no-existe"))?.status()).toBe(404);
    expect((await page.goto("/artist/esti/work/no-existe"))?.status()).toBe(404);
  });

  test("si falta una foto muestra un reemplazo en vez de una imagen rota", async ({ page }) => {
    await page.route("**/_next/image**", (route) => route.fulfill({ status: 404 }));
    await page.goto("/artist/esti/work/tigre");
    await expect(page.getByText("Imagen no disponible").first()).toBeVisible();
  });
});
