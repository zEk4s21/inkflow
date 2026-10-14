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
