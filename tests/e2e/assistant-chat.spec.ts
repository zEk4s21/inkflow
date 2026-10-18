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

  test("la página pública ofrece el asistente en contacto", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await page.getByRole("link", { name: "Armar mi idea con el asistente" }).click();
    await expect(page).toHaveURL(new RegExp(`/artist/${studio.slug}/assistant$`));
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
    await expect(resumen.getByRole("button", { name: "Revisar y enviar" })).toBeVisible();

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

  test("sin confirmación no se crea nada; confirmada llega al panel con la conversación", async ({ page }, testInfo) => {
    await page.goto(`/artist/${studio.slug}/assistant`);
    const log = page.getByRole("log", { name: "Mensajes" });
    const box = page.getByRole("textbox", { name: "Tu mensaje" });
    await expect(async () => {
      await box.fill("Un tigre entre flores de loto");
      await box.press("Enter");
      await expect(log).toContainText("Anoté tu idea", { timeout: 2000 });
    }).toPass();
    for (const [text, reply] of [["Espalda alta", "Anoté la zona"], ["30 cm", "ya tengo lo básico"]]) {
      await box.fill(text);
      await box.press("Enter");
      await expect(log).toContainText(reply);
    }

    await page.getByRole("button", { name: "Revisar y enviar" }).click();
    const review = page.getByRole("form", { name: "Revisar y enviar" });
    await expect(review.getByRole("textbox", { name: "Idea" })).toHaveValue("Un tigre entre flores de loto");
    await review.getByRole("textbox", { name: "Estilo" }).fill("Japonés");
    await review.getByRole("combobox", { name: "Color" }).selectOption("color");
    const name = `Cliente asistente ${testInfo.project.name}`;
    await review.getByRole("textbox", { name: "Nombre" }).fill(name);
    await review.getByRole("textbox", { name: "Email" }).fill(`asistente-${testInfo.project.name}-${Date.now()}@example.com`);

    // Sin tildar la confirmación, el servidor no crea nada (se saltea la validación del navegador).
    await review.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(review.getByText("Tildá la confirmación para enviar.")).toBeVisible();
    const requests = () =>
      adminClient().from("tattoo_requests").select("id, source, style, color_mode, conversation_id, workspaces!inner (slug)").eq("workspaces.slug", studio.slug);
    expect((await requests()).data).toEqual([]);
    // Lo escrito no se pierde después del error.
    await expect(review.getByRole("textbox", { name: "Nombre" })).toHaveValue(name);

    await review.getByRole("checkbox", { name: "Revisé el resumen y quiero enviar la consulta." }).check();
    await review.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Recibí tu consulta" })).toBeVisible();
    await expect(box).toHaveCount(0);
    const { data } = await requests();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ source: "assistant", style: "Japonés", color_mode: "color" });
    expect(data?.[0].conversation_id).toBeTruthy();

    // Al volver, la conversación figura como enviada y se puede empezar otra.
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Recibí tu consulta" })).toBeVisible();
    await page.getByRole("button", { name: "Empezar de nuevo" }).click();
    await expect(page.getByRole("textbox", { name: "Tu mensaje" })).toBeVisible();

    await signIn(page, studio.email);
    await page.goto("/panel/solicitudes");
    await page.getByRole("link", { name: new RegExp(name) }).first().click();
    await expect(page.getByText("desde el asistente")).toBeVisible();
    await expect(page.getByText("Japonés")).toBeVisible();
    const conversation = page.getByRole("region", { name: "Conversación con el asistente" });
    await conversation.getByText("Conversación con el asistente").click();
    await expect(conversation).toContainText("Espalda alta");
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
    // Consumo del mes de este estudio (las respuestas simuladas no gastan tokens).
    await expect(card.getByText("Este mes")).toBeVisible();
    await expect(card.getByText("Conversaciones")).toBeVisible();
    await expect(card).toContainText("Sin tope mensual");
  });
});
