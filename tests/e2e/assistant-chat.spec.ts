import { expect, test } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn, SIMULATED_AI_PORT } from "./helpers";

// Servidor aparte con AI_PROVIDER=simulated: respuestas fijas, sin IA ni clave.
test.use({ baseURL: `http://localhost:${SIMULATED_AI_PORT}` });

test.describe("Ink Assistant con respuestas simuladas", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  let studio: Awaited<ReturnType<typeof createStudio>>;

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`chat-${testInfo.project.name}`, { role: "owner" });
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("arma el resumen, lo recuerda al volver y se puede empezar de nuevo", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}/assistant`);
    await expect(page.getByText("Respuestas simuladas (prueba)")).toBeVisible();
    const log = page.getByRole("log", { name: "Mensajes" });
    await expect(log).toContainText("Soy el asistente de Prueba");
    const resumen = page.getByRole("complementary", { name: "Resumen de tu idea" });
    const box = page.getByRole("textbox", { name: "Tu mensaje" });

    // El primer envío puede llegar antes de que la página termine de cargar: se reintenta.
    await expect(async () => {
      await box.fill("Una golondrina con una rosa");
      await box.press("Enter");
      await expect(log).toContainText("Anoté tu idea", { timeout: 2000 });
    }).toPass();
    await expect(resumen).toContainText("Una golondrina con una rosa");

    await box.fill("Antebrazo");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(log).toContainText("Anoté la zona");
    await box.fill("10 cm");
    await box.press("Enter");
    await expect(log).toContainText("ya tengo lo básico");
    await expect(resumen.getByRole("status")).toContainText("Ya está lo básico");
    await expect(resumen.getByRole("link", { name: "Ir al formulario" })).toBeVisible();

    // En la base quedó la conversación con el resumen validado, y el token solo como hash.
    const { data } = await adminClient()
      .from("conversations")
      .select("brief, message_count, token_hash, workspaces!inner (slug)")
      .eq("workspaces.slug", studio.slug)
      .single()
      .throwOnError();
    expect(data).toMatchObject({ brief: { idea: "Una golondrina con una rosa", bodyZone: "Antebrazo", sizeLabel: "10 cm" }, message_count: 3 });
    const cookie = (await page.context().cookies()).find((item) => item.name === "inkflow_assistant");
    expect(cookie).toMatchObject({ httpOnly: true, path: `/artist/${studio.slug}/assistant` });
    expect(data.token_hash).not.toBe(cookie?.value);

    await page.reload();
    await expect(log).toContainText("Una golondrina con una rosa");
    await expect(resumen).toContainText("10 cm");

    await page.getByRole("button", { name: "Empezar de nuevo" }).click();
    await expect(log).not.toContainText("Una golondrina con una rosa");
    await expect(resumen).not.toContainText("10 cm");
    await expect(resumen.getByText("Falta")).toHaveCount(3);
  });

  test("no acepta mensajes vacíos ni más largos que el tope", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}/assistant`);
    const box = page.getByRole("textbox", { name: "Tu mensaje" });
    await expect(box).toHaveAttribute("maxlength", "1000");
    await expect(box).toHaveAttribute("required", "");
  });

  test("el panel avisa que las respuestas son simuladas", async ({ page }) => {
    await signIn(page, studio.email);
    await page.goto("/panel/ajustes");
    const card = page.getByRole("region", { name: "Ink Assistant" });
    await expect(card.getByText("Simulado (sin IA)")).toBeVisible();
    await expect(card).toContainText("nunca en producción");
  });
});
