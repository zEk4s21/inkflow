import { expect, test, type Page } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn } from "./helpers";

function randomIp() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
}

async function fillRequest(page: Page, name: string) {
  await page.goto("about:blank");
  await page.goto(`/artist/${studio.slug}#contacto`);
  await page.getByRole("textbox", { name: "Tu idea", exact: true }).fill("Una serpiente en el gemelo, línea fina");
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(`${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}-${Date.now()}@example.com`);
}

/** Elige el segundo día con turnos (el primero puede quedar recortado por la anticipación) y su primer horario. */
async function pickSlot(page: Page) {
  const picker = page.getByRole("group", { name: "Turno (opcional)" });
  const time = picker.getByRole("radio").first();
  // Un clic antes de que React tome la página se pierde: se reintenta hasta que aparecen los horarios.
  await expect(async () => {
    await picker.getByRole("group", { name: "Día" }).getByRole("button").nth(1).click();
    await expect(time).toBeAttached({ timeout: 1000 });
  }).toPass();
  await time.check({ force: true });
  return picker;
}

let studio: Awaited<ReturnType<typeof createStudio>>;
let artistId = "";

test.describe("pedido de turno desde la página pública", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`turnos-${testInfo.project.name}`, { role: "owner" });
    const admin = adminClient();
    const { data } = await admin.from("artist_profiles").select("id").eq("workspace_id", studio.workspaceId).single().throwOnError();
    artistId = data.id;
    // Todos los días de 10 a 18, turnos de 3 horas con 30 minutos de margen.
    await admin
      .from("availability_rules")
      .insert(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          workspace_id: studio.workspaceId,
          artist_id: artistId,
          weekday,
          start_time: "10:00",
          end_time: "18:00",
          slot_minutes: 180,
          buffer_minutes: 30,
        })),
      )
      .throwOnError();
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("el turno pedido queda a confirmar y aparece en el panel", async ({ browser, page }) => {
    const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const form = await visitor.newPage();
    await fillRequest(form, "Martina Ruiz");
    const picker = await pickSlot(form);
    await expect(picker.getByText(/^Pedís turno para el .+ a las 10:00\.$/)).toBeVisible();
    await form.getByRole("button", { name: "Enviar consulta y pedir turno" }).click();
    await expect(form.getByText("¡Gracias!")).toBeVisible();
    await expect(form.getByText(/anoté tu pedido de turno para el .+ a las 10:00\. Todavía no está reservado/)).toBeVisible();
    await expect(form.getByText(/reservado:/)).toBeVisible();
    await visitor.close();

    await signIn(page, studio.email);
    await page.goto("/panel/solicitudes");
    await page.getByRole("link", { name: /Martina Ruiz/ }).click();
    const card = page.getByRole("region", { name: "Turnos", exact: true });
    await expect(card.getByText(/10:00 a 13:00/)).toBeVisible();
    await expect(card.getByText("A confirmar")).toBeVisible();

    await page.goto("/panel/agenda");
    const requested = page.getByRole("region", { name: "Turnos pedidos" });
    await expect(requested.getByText("Martina Ruiz")).toBeVisible();
    await requested.getByRole("link", { name: "Ver solicitud" }).click();
    await expect(page.getByRole("heading", { name: "Martina Ruiz" })).toBeVisible();
  });

  test("rechaza un turno que ya no está libre o que no existe, sin guardar la consulta", async ({ browser }) => {
    const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const form = await visitor.newPage();

    // Turno inventado: no sale de la lista que calcula el servidor.
    await fillRequest(form, "Pedro Inventado");
    await pickSlot(form);
    await form.locator('input[name="slot"]').evaluate((input: HTMLInputElement) => (input.value = "2031-01-01T03:00:00.000Z"));
    await form.getByRole("button", { name: "Enviar consulta y pedir turno" }).click();
    await expect(form.getByRole("alert").filter({ hasText: "Ese turno ya no está disponible" })).toBeVisible();

    // Turno que se bloqueó mientras completaba el formulario.
    await fillRequest(form, "Pedro Bloqueado");
    await pickSlot(form);
    const admin = adminClient();
    const now = Date.now();
    const { data: block } = await admin
      .from("availability_blocks")
      .insert({
        workspace_id: studio.workspaceId,
        artist_id: artistId,
        period: `[${new Date(now).toISOString()},${new Date(now + 40 * 86_400_000).toISOString()})`,
      })
      .select("id")
      .single()
      .throwOnError();
    await form.getByRole("button", { name: "Enviar consulta y pedir turno" }).click();
    await expect(form.getByRole("alert").filter({ hasText: "Ese turno ya no está disponible" })).toBeVisible();
    // La lista se vuelve a pedir: con todo bloqueado ya no hay turnos para elegir y el resto se conserva.
    await expect(form.getByRole("group", { name: "Turno (opcional)" })).toHaveCount(0);
    await expect(form.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Pedro Bloqueado");
    await expect(form.getByRole("button", { name: "Enviar consulta", exact: true })).toBeVisible();
    await admin.from("availability_blocks").delete().eq("id", block.id).throwOnError();
    await visitor.close();

    const { data } = await admin.from("clients").select("id").eq("workspace_id", studio.workspaceId).like("name", "Pedro%").throwOnError();
    expect(data).toEqual([]);
  });

  test("confirma, reprograma, cancela y da turnos a mano sin pisar otro confirmado", async ({ browser, page }) => {
    const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
    const form = await visitor.newPage();
    await fillRequest(form, "Sofía Lagos");
    await pickSlot(form);
    await form.getByRole("button", { name: "Enviar consulta y pedir turno" }).click();
    await expect(form.getByText("¡Gracias!")).toBeVisible();
    await visitor.close();

    await signIn(page, studio.email);
    await page.goto("/panel/agenda");
    const requested = page.getByRole("region", { name: "Turnos pedidos" });
    const row = requested.getByRole("listitem").filter({ hasText: "Sofía Lagos" });
    await row.getByRole("button", { name: /^Confirmar turno del / }).click();
    const confirmed = page.getByRole("region", { name: "Turnos confirmados" });
    const confirmedRow = confirmed.getByRole("listitem").filter({ hasText: "Sofía Lagos" });
    await expect(confirmedRow.getByText(/10:00 a 13:00/)).toBeVisible();

    // Reprogramar a las 14:00 del mismo día.
    await confirmedRow.getByRole("button", { name: "Reprogramar" }).click();
    await confirmedRow.getByLabel("Hora").fill("14:00");
    await confirmedRow.getByRole("button", { name: "Guardar nuevo horario" }).click();
    await expect(confirmedRow.getByText(/14:00 a 17:00/)).toBeVisible();

    // Dar turno a mano desde la solicitud, encima del confirmado: lo rechaza la base.
    await confirmedRow.getByRole("link", { name: "Ver solicitud" }).click();
    await page.waitForURL(/\/panel\/solicitudes\//);
    const card = page.getByRole("region", { name: "Turnos", exact: true });
    await expect(card.getByText("Confirmado", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Dar turno" }).click();
    // Mismo día que el confirmado, a las 15:00: se pisa.
    const confirmedDate = await adminClient()
      .from("appointments")
      .select("period")
      .eq("workspace_id", studio.workspaceId)
      .eq("status", "confirmed")
      .single()
      .throwOnError();
    const startIso = /^[[(]"?([^",]+)/.exec(confirmedDate.data.period as string)![1].replace(" ", "T").replace(/\+00$/, "Z");
    const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(startIso));
    await card.getByLabel("Día").fill(localDay);
    await card.getByLabel("Hora").fill("15:00");
    await card.getByRole("button", { name: "Confirmar turno", exact: true }).click();
    await expect(card.getByRole("alert").filter({ hasText: "Se pisa con otro turno confirmado" })).toBeVisible();
    // Al día siguiente sí entra.
    const nextDay = new Date(Date.parse(`${localDay}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    await card.getByLabel("Día").fill(nextDay);
    await card.getByRole("button", { name: "Confirmar turno", exact: true }).click();
    await expect(card.getByText("Confirmado", { exact: true })).toHaveCount(2);

    // Cancelar el primero.
    const first = card.getByRole("listitem").filter({ hasText: /14:00 a 17:00/ });
    await first.getByRole("button", { name: "Cancelar turno" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar turno" }).click();
    await expect(first.getByText("Cancelado")).toBeVisible();
  });
});
