import { expect, test } from "@playwright/test";
import { createStudio, hasDatabase, signIn, TINY_PNG } from "./helpers";

test.describe("portfolio administrable", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  test("subir, ocultar y borrar un trabajo", async ({ page }, testInfo) => {
    const studio = await createStudio(`porta-${testInfo.project.name}`, { role: "owner" });
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/portfolio");

      await page.getByRole("button", { name: "Agregar trabajo" }).click();
      await page.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: TINY_PNG });
      await expect(page.getByAltText("Vista previa de la foto elegida")).toBeVisible();
      await page.getByLabel("Título").fill("Rosa en antebrazo");
      await page.getByLabel("Categoría").fill("Flores");
      await page.getByRole("button", { name: "Guardar trabajo" }).click();
      const card = page.getByRole("listitem").filter({ hasText: "Rosa en antebrazo" });
      await expect(card.getByText("Publicado")).toBeVisible();
      expect(await studio.storageFiles()).toHaveLength(1);

      await page.goto(`/artist/${studio.slug}`);
      await expect(page.locator("#trabajos").getByText("Rosa en antebrazo")).toBeVisible();

      await page.goto("/panel/portfolio");
      await card.getByRole("button", { name: "Ocultar" }).click();
      await expect(card.getByText("Borrador")).toBeVisible();
      await page.goto(`/artist/${studio.slug}`);
      await expect(page.getByText("Todavía no hay trabajos publicados.")).toBeVisible();

      await page.goto("/panel/portfolio");
      await card.getByRole("button", { name: "Borrar" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
      await expect(page.getByText("Todavía no hay trabajos")).toBeVisible();
      expect(await studio.storageFiles()).toHaveLength(0);
    } finally {
      await studio.cleanup();
    }
  });

  test("valida los campos sin perder la foto elegida", async ({ page }, testInfo) => {
    const studio = await createStudio(`valida-${testInfo.project.name}`, { role: "owner" });
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/portfolio");
      await page.getByRole("button", { name: "Agregar trabajo" }).click();
      await page.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: TINY_PNG });
      await page.getByRole("button", { name: "Guardar trabajo" }).click();
      await expect(page.getByText("Poné un título.")).toBeVisible();
      await expect(page.getByAltText("Vista previa de la foto elegida")).toBeVisible();
      // La foto subida para el intento fallido no queda en el bucket.
      expect(await studio.storageFiles()).toHaveLength(0);
    } finally {
      await studio.cleanup();
    }
  });

  test("reordenar cambia el orden de la página pública", async ({ page }, testInfo) => {
    const studio = await createStudio(`orden-${testInfo.project.name}`, {
      role: "owner",
      works: [
        { title: "Primero", category: "A" },
        { title: "Segundo", category: "A" },
      ],
    });
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/portfolio");
      await page.getByRole("button", { name: "Bajar Primero" }).click();
      await expect(page.getByRole("listitem").first()).toContainText("Segundo");
      await page.goto(`/artist/${studio.slug}`);
      await expect(page.locator("#trabajos ul li").first()).toContainText("Segundo");
    } finally {
      await studio.cleanup();
    }
  });

  test("staff ve el portfolio pero no puede editarlo", async ({ page }, testInfo) => {
    const studio = await createStudio(`staffp-${testInfo.project.name}`, {
      role: "staff",
      works: [{ title: "Solo lectura", category: "A" }],
    });
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/portfolio");
      await expect(page.getByText("Solo lectura")).toBeVisible();
      await expect(page.getByRole("button", { name: "Agregar trabajo" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
    } finally {
      await studio.cleanup();
    }
  });
});
