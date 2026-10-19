import { expect, test } from "@playwright/test";
import { adminClient, createStudio, hasDatabase, signIn } from "./helpers";

test.describe("cuidados y controles", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  test("al cerrar la sesión se agendan controles y el cliente ve los cuidados", async ({ page, browser }, testInfo) => {
    const studio = await createStudio(`ctrl-${testInfo.project.name}`, { role: "owner" });
    try {
      const admin = adminClient();
      const { data: artist } = await admin.from("artist_profiles").select("id").eq("workspace_id", studio.workspaceId).single().throwOnError();
      const { data: client } = await admin
        .from("clients")
        .insert({ workspace_id: studio.workspaceId, name: "Camila Ortiz", phone: "5491155557777" })
        .select("id")
        .single()
        .throwOnError();
      const { data: request } = await admin
        .from("tattoo_requests")
        .insert({ workspace_id: studio.workspaceId, client_id: client.id, idea: "Una mariposa en el tobillo, línea fina.", status: "accepted" })
        .select("id")
        .single()
        .throwOnError();
      // Sesión de ayer, todavía sin cerrar.
      const start = new Date(Date.now() - 26 * 3_600_000);
      const end = new Date(start.getTime() + 3 * 3_600_000);
      await admin
        .from("appointments")
        .insert({
          workspace_id: studio.workspaceId,
          artist_id: artist.id,
          client_id: client.id,
          request_id: request.id,
          period: `[${start.toISOString()},${end.toISOString()})`,
          status: "confirmed",
        })
        .throwOnError();

      await signIn(page, studio.email);
      await page.goto("/panel/ajustes");
      const care = page.getByRole("region", { name: "Cuidados después de la sesión" });
      await care.getByRole("textbox", { name: "Indicaciones de cuidado" }).fill("Indicaciones de prueba del estudio.");
      await care.getByRole("button", { name: "Guardar cuidados" }).click();
      await expect(care.getByText("Cambios guardados.")).toBeVisible();

      await page.goto(`/panel/solicitudes/${request.id}`);
      const link = page.getByRole("region", { name: "Link para el cliente" });
      await link.getByRole("button", { name: "Generar link" }).click();
      const trackingPath = new URL(await link.getByRole("textbox", { name: "Link para el cliente" }).inputValue()).pathname;

      const visitor = await browser.newContext();
      const tracking = await visitor.newPage();
      await tracking.goto(trackingPath);
      await expect(tracking.getByRole("heading", { name: "Hola, Camila" })).toBeVisible();
      // Antes de la sesión no hay cuidados.
      await expect(tracking.getByRole("region", { name: "Cuidados" })).toHaveCount(0);

      await page.getByRole("region", { name: "Turnos", exact: true }).getByRole("button", { name: "Realizado" }).click();
      const controls = page.getByRole("region", { name: "Controles" });
      await expect(controls.getByText("Ver cómo cicatrizó")).toBeVisible();
      await expect(controls.getByText("Ofrecer retoque")).toBeVisible();

      await controls.getByRole("button", { name: "Agregar control" }).click();
      await controls.getByRole("textbox", { name: "Qué hacer" }).fill("Mandarle foto del curado");
      await controls.getByRole("button", { name: "Guardar control" }).click();
      await expect(controls.getByText("Mandarle foto del curado")).toBeVisible();

      await tracking.reload();
      await expect(tracking.getByRole("region", { name: "Cuidados" }).getByText("Indicaciones de prueba del estudio.")).toBeVisible();
      await visitor.close();

      // En el inicio aparece el control de la semana, con WhatsApp para escribirle.
      await page.goto("/panel");
      const home = page.getByRole("region", { name: "Controles de la semana" });
      await expect(home.getByRole("link", { name: "Camila Ortiz" }).first()).toBeVisible();
      await expect(home.getByRole("link", { name: "WhatsApp" }).first()).toHaveAttribute("href", "https://wa.me/5491155557777");
      await home.getByRole("button", { name: "Marcar hecho: Ver cómo cicatrizó (Camila Ortiz)" }).click();
      await expect(home.getByText("Ver cómo cicatrizó")).toHaveCount(0);
    } finally {
      await studio.cleanup();
    }
  });
});
