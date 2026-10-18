import { expect, test, type Page } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn } from "./helpers";

// IP inventada por test: el límite de envíos cuenta por IP y así los tests no se pisan.
function randomIp() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
}

// Recarga completa: después de "¡Gracias!" el formulario no vuelve solo, y un goto que solo
// cambia el hash no recarga la página.
async function openForm(page: Page, slug: string) {
  await page.goto("about:blank");
  await page.goto(`/artist/${slug}#contacto`);
}

async function fillRequest(page: Page, values: { name: string; email?: string; phone?: string; idea?: string }) {
  await page.getByRole("textbox", { name: "Tu idea", exact: true }).fill(values.idea ?? "Una golondrina tradicional en el antebrazo");
  await page.getByRole("textbox", { name: "Zona del cuerpo", exact: true }).fill("Antebrazo");
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(values.name);
  if (values.email) await page.getByRole("textbox", { name: "Email", exact: true }).fill(values.email);
  if (values.phone) await page.getByRole("textbox", { name: "WhatsApp", exact: true }).fill(values.phone);
}

test.describe("consultas desde la página pública", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  let studio: Awaited<ReturnType<typeof createStudio>>;

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`consultas-${testInfo.project.name}`, { role: "owner" });
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("la consulta llega al panel y el mismo email es el mismo cliente", async ({ browser, page }) => {
    const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const form = await visitor.newPage();
    for (const idea of ["Una golondrina tradicional en el antebrazo", "Un tigre japonés en la espalda completa"]) {
      await openForm(form, studio.slug);
      await fillRequest(form, { name: "Lucía Gómez", email: "Lucia@Example.com", phone: "+54 9 11 2233-4455", idea });
      await form.getByRole("button", { name: "Enviar consulta" }).click();
      await expect(form.getByText("¡Gracias!")).toBeVisible();
    }
    await visitor.close();

    await signIn(page, studio.email);
    await page.goto("/panel/solicitudes");
    await expect(page.getByRole("link", { name: /Lucía Gómez/ })).toHaveCount(2);
    await page.getByRole("link", { name: /Un tigre japonés/ }).click();
    await expect(page.getByText("Un tigre japonés en la espalda completa")).toBeVisible();
    await expect(page.getByRole("link", { name: "lucia@example.com" })).toHaveAttribute("href", "mailto:lucia@example.com");

    await page.goto("/panel/clientes");
    await expect(page.getByText("Lucía Gómez")).toHaveCount(1);
    await expect(page.getByText("2 solicitudes")).toBeVisible();
  });

  test("pide email o WhatsApp y no guarda nada si falta", async ({ browser }) => {
    const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const form = await visitor.newPage();
    await openForm(form, studio.slug);
    await fillRequest(form, { name: "Sin contacto" });
    await form.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(form.getByText("Revisá los campos marcados.")).toBeVisible();
    await expect(form.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Sin contacto");
    await visitor.close();
  });

  test("corta después de 3 consultas seguidas desde la misma conexión", async ({ browser }) => {
    const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const form = await visitor.newPage();
    for (let attempt = 1; attempt <= 4; attempt++) {
      await openForm(form, studio.slug);
      await fillRequest(form, { name: `Insistente ${attempt}`, email: `insistente-${attempt}@example.com` });
      await form.getByRole("button", { name: "Enviar consulta" }).click();
      if (attempt <= 3) await expect(form.getByText("¡Gracias!")).toBeVisible();
      else await expect(form.getByText(/Recibimos varias consultas seguidas/)).toBeVisible();
    }
    await visitor.close();
  });

  test("cambia el estado, deja notas y filtra por estado", async ({ page }) => {
    const admin = adminClient();
    const { data: client } = await admin
      .from("clients")
      .insert({ workspace_id: studio.workspaceId, name: "Martina Seguimiento", phone: "5491100001111" })
      .select("id")
      .single()
      .throwOnError();
    const { data: request } = await admin
      .from("tattoo_requests")
      .insert({ workspace_id: studio.workspaceId, client_id: client.id, idea: "Una rosa fineline en la muñeca" })
      .select("id")
      .single()
      .throwOnError();

    await signIn(page, studio.email);
    await page.goto(`/panel/solicitudes/${request.id}`);
    await page.getByRole("combobox", { name: "Estado" }).selectOption("quoted");
    await expect(page.getByText("Vos pasó de Nueva a Presupuestada")).toBeVisible();

    await page.getByRole("textbox", { name: "Nueva nota" }).fill("Le pasé $80.000 por WhatsApp");
    await page.getByRole("button", { name: "Agregar nota" }).click();
    await expect(page.getByText("Le pasé $80.000 por WhatsApp")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nueva nota" })).toHaveValue("");

    // Después de recargar sigue todo guardado.
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Estado" })).toHaveValue("quoted");
    await expect(page.getByText("Nota de Vos")).toBeVisible();

    await page.getByRole("button", { name: "Borrar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
    await expect(page.getByText("Le pasé $80.000 por WhatsApp")).toHaveCount(0);

    await page.goto("/panel/solicitudes");
    const filters = page.getByRole("navigation", { name: "Filtrar por estado" });
    await filters.getByRole("link", { name: /Presupuestada/ }).click();
    await expect(page).toHaveURL(/estado=quoted/);
    await expect(page.getByRole("link", { name: /Martina Seguimiento/ })).toBeVisible();
    await expect(page.locator("main ul li")).toHaveCount(1);
  });
});
