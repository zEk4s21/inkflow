import { expect, test } from "@playwright/test";
import { createStudio, hasDatabase, signIn } from "./helpers";

const localDate = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(Date.now() + offsetDays * 86_400_000));

test.describe("agenda: horarios y bloqueos", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  let studio: Awaited<ReturnType<typeof createStudio>>;

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`agenda-${testInfo.project.name}`, { role: "owner" });
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("carga el horario, ve los turnos libres y los bloquea", async ({ page }) => {
    await signIn(page, studio.email);
    await page.goto("/panel/agenda");
    await expect(page.getByText("Cargá tu horario semanal para ver los turnos.")).toBeVisible();

    // Lunes a viernes de 10 a 18, turnos de 3 horas con 30 minutos de margen.
    for (const day of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]) {
      await page.getByRole("checkbox", { name: day }).check();
    }
    await page.getByLabel("Lunes: desde").fill("10:00");
    await page.getByLabel("Lunes: hasta").fill("09:00");
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(page.getByText("La hora de cierre tiene que ser después de la de inicio.")).toBeVisible();

    await page.getByLabel("Lunes: hasta").fill("18:00");
    await page.getByRole("combobox", { name: "Duración de cada turno" }).selectOption("180");
    await page.getByRole("button", { name: "Guardar horario" }).click();

    const preview = page.getByRole("region", { name: "Turnos libres en las próximas dos semanas" });
    // Dos semanas de lunes a viernes, menos lo que cae dentro de las 24 horas de anticipación.
    await expect(preview.getByText("10:00").first()).toBeVisible();
    await expect(preview.getByText("13:30").first()).toBeVisible();
    expect(await preview.locator("li").count()).toBeGreaterThanOrEqual(8);

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Lunes" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Sábado" })).not.toBeChecked();

    // Un bloqueo de 15 días deja la vista previa sin turnos.
    await page.getByLabel("Desde", { exact: true }).fill(localDate(0));
    await page.getByLabel("Hasta", { exact: true }).fill(localDate(15));
    await page.getByLabel("Motivo").fill("Viaje a Japón");
    await page.getByRole("button", { name: "Agregar bloqueo" }).click();
    await expect(page.getByText("Viaje a Japón", { exact: true })).toBeVisible();
    await expect(page.getByText("No quedan turnos libres en estas dos semanas.")).toBeVisible();

    await page.getByRole("button", { name: /Quitar bloqueo/ }).click();
    await expect(page.getByText("Viaje a Japón", { exact: true })).toHaveCount(0);
    await expect(preview.getByText("10:00").first()).toBeVisible();
  });
});
