import { expect, test } from "@playwright/test";
import { adminClient, hasDatabase, signIn } from "./helpers";

// Cada test usa su propio workspace para no pisar los datos del seed ni de otros tests.
test.describe("edición del perfil y la página pública", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  async function createStudio(label: string, role: "owner" | "staff" = "owner") {
    const admin = adminClient();
    const slug = `e2e-${label}-${Date.now()}`;
    const email = `${slug}@example.com`;
    const { data: workspace } = await admin.from("workspaces").insert({ slug, name: slug }).select("id").single().throwOnError();
    await admin.from("workspace_settings").insert({ workspace_id: workspace.id }).throwOnError();
    await admin
      .from("artist_profiles")
      .insert({ workspace_id: workspace.id, display_name: "Prueba", is_public: true })
      .throwOnError();
    const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
    await admin.from("workspace_members").insert({ workspace_id: workspace.id, user_id: data.user!.id, role }).throwOnError();
    return {
      slug,
      email,
      cleanup: async () => {
        await admin.from("workspaces").delete().eq("id", workspace.id);
        await admin.auth.admin.deleteUser(data.user!.id);
      },
    };
  }

  test("el owner edita el perfil y se ve en la página pública", async ({ page }, testInfo) => {
    const studio = await createStudio(`perfil-${testInfo.project.name}`);
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/ajustes");

      await page.getByLabel("Nombre artístico").fill("Tinta Prueba");
      await page.getByLabel("Biografía").fill("Tatúo hace diez años en negro y gris.");
      await page.getByLabel("Estilos").fill("Black & Grey, Blackwork");
      await page.getByLabel("Instagram").fill("https://www.instagram.com/tinta.prueba/");
      await page.getByRole("button", { name: "Guardar perfil" }).click();
      await expect(page.getByText("Cambios guardados.")).toBeVisible();

      await page.goto(`/artist/${studio.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Tinta Prueba");
      await expect(page.getByText("Tatúo hace diez años en negro y gris.")).toBeVisible();
      await expect(page.getByRole("link", { name: "@tinta.prueba", exact: true })).toHaveAttribute(
        "href",
        "https://www.instagram.com/tinta.prueba/",
      );
    } finally {
      await studio.cleanup();
    }
  });

  test("un error de validación no borra lo escrito", async ({ page }, testInfo) => {
    const studio = await createStudio(`validacion-${testInfo.project.name}`);
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/ajustes");
      await page.getByLabel("Nombre artístico").fill("");
      await page.getByLabel("Biografía").fill("Texto que no se tiene que perder");
      await page.getByRole("button", { name: "Guardar perfil" }).click();
      await expect(page.getByText("Poné tu nombre artístico.")).toBeVisible();
      await expect(page.getByLabel("Biografía")).toHaveValue("Texto que no se tiene que perder");
    } finally {
      await studio.cleanup();
    }
  });

  test("despublicar oculta la página", async ({ page }, testInfo) => {
    const studio = await createStudio(`publicar-${testInfo.project.name}`);
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/ajustes");
      await page.getByLabel("Página publicada").uncheck();
      await page.getByRole("button", { name: "Guardar perfil" }).click();
      await expect(page.getByText("Cambios guardados.")).toBeVisible();
      expect((await page.goto(`/artist/${studio.slug}`))?.status()).toBe(404);
    } finally {
      await studio.cleanup();
    }
  });

  test("edita el proceso y las preguntas frecuentes", async ({ page }, testInfo) => {
    const studio = await createStudio(`textos-${testInfo.project.name}`);
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/ajustes");
      await page.getByRole("button", { name: "Agregar paso" }).click();
      await page.getByLabel("Paso 1").fill("Charlamos la idea");
      await page.getByLabel("Descripción").fill("Me contás qué querés tatuarte.");
      await page.getByRole("button", { name: "Agregar pregunta" }).click();
      await page.getByLabel("Pregunta 1").fill("¿Hacés color?");
      await page.getByLabel("Respuesta").fill("No, solo negro y gris.");
      await page.getByRole("button", { name: "Guardar textos" }).click();
      await expect(page.getByText("Cambios guardados.")).toBeVisible();

      await page.goto(`/artist/${studio.slug}`);
      await expect(page.getByRole("heading", { level: 2, name: "El proceso" })).toBeVisible();
      await expect(page.getByText("Charlamos la idea")).toBeVisible();
      await expect(page.getByText("¿Hacés color?")).toBeVisible();
    } finally {
      await studio.cleanup();
    }
  });

  test("un miembro staff no puede editar", async ({ page }, testInfo) => {
    const studio = await createStudio(`staff-${testInfo.project.name}`, "staff");
    try {
      await signIn(page, studio.email);
      await page.goto("/panel/ajustes");
      await expect(page.getByText("Solo el owner del estudio puede editar")).toBeVisible();
      await expect(page.getByRole("button", { name: "Guardar perfil" })).toHaveCount(0);
    } finally {
      await studio.cleanup();
    }
  });
});
