import { expect, test } from "@playwright/test";
import { adminClient as admin, hasDatabase, magicLinkFor } from "./helpers";

// Requiere Supabase local con el seed (workspace "esti"). En CI corre en el job "database".
test.describe("login por magic link", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  const WORKSPACE_ESTI = "00000000-0000-4000-8000-000000000001";

  test("un miembro entra al panel de su estudio y sale", async ({ page }, testInfo) => {
    const email = `owner-${testInfo.project.name}-${Date.now()}@example.com`;
    const { data } = await admin().auth.admin.createUser({ email, email_confirm: true });
    const userId = data.user!.id;
    await admin().from("workspace_members").insert({ workspace_id: WORKSPACE_ESTI, user_id: userId, role: "owner" });

    try {
      await page.goto(await magicLinkFor(email));
      await expect(page).toHaveURL(/\/panel$/);
      await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();

      await page.goto("/panel/ajustes");
      await expect(page.getByLabel("Nombre completo")).toHaveValue("Esteban Fernández");

      // El link es de un solo uso.
      const link = await magicLinkFor(email);
      await page.goto(link);
      await page.goto(link);
      await expect(page).toHaveURL(/error=link/);
    } finally {
      await admin().auth.admin.deleteUser(userId);
    }
  });

  test("una cuenta sin estudio no ve el panel", async ({ page }, testInfo) => {
    const email = `sin-estudio-${testInfo.project.name}-${Date.now()}@example.com`;
    const { data } = await admin().auth.admin.createUser({ email, email_confirm: true });
    try {
      await page.goto(await magicLinkFor(email));
      await expect(page.getByRole("heading", { name: "Tu cuenta no tiene un estudio" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Panel" })).toHaveCount(0);
      await page.getByRole("button", { name: "Salir" }).click();
      await expect(page).toHaveURL(/\/ingresar$/);
    } finally {
      await admin().auth.admin.deleteUser(data.user!.id);
    }
  });
});
