import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

// Requiere Supabase local con el seed (workspace "esti"). En CI corre en el job "database".
test.describe("login por magic link", () => {
  test.skip(!url || !secretKey, "Necesita Supabase local");

  const admin = () => createClient(url!, secretKey!, { auth: { persistSession: false } });
  const WORKSPACE_ESTI = "00000000-0000-4000-8000-000000000001";

  async function magicLinkFor(email: string) {
    const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`;
  }

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
      await expect(page.getByRole("main").getByText("Esteban Fernández")).toBeVisible();

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
