import { expect, test } from "@playwright/test";

test("la home responde en español y no se indexa todavía", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("INKFLOW");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("una ruta inexistente devuelve 404", async ({ page }) => {
  const response = await page.goto("/esta-ruta-no-existe");
  expect(response?.status()).toBe(404);
});

test("el catálogo de diseño no existe en producción", async ({ page }) => {
  const response = await page.goto("/dev/ui");
  expect(response?.status()).toBe(404);
});

test("el panel no existe en producción mientras no haya login", async ({ page }) => {
  for (const path of ["/panel", "/panel/solicitudes", "/panel/ajustes"]) {
    expect((await page.goto(path))?.status()).toBe(404);
  }
});
