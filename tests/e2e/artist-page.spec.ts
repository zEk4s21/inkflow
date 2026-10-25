import { expect, test } from "@playwright/test";
import { createStudio, hasDatabase } from "./helpers";

test.describe("página pública del tatuador", () => {
  test.skip(!hasDatabase, "Necesita Supabase local");

  let studio: Awaited<ReturnType<typeof createStudio>>;

  test.beforeAll(async ({}, testInfo) => {
    studio = await createStudio(`publica-${testInfo.project.name}`, {
      works: [
        { title: "Tigre", category: "Animales" },
        { title: "Pagoda", category: "Oriental" },
        { title: "Buda", category: "Oriental" },
        { title: "Boceto sin publicar", category: "Bocetos", status: "draft" },
      ],
    });
  });

  test.afterAll(async () => {
    await studio?.cleanup();
  });

  test("muestra portada y secciones, sin trabajos en borrador", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Prueba");
    for (const title of ["Trabajos", "Contame tu idea"]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await expect(page.locator("#trabajos ul li")).toHaveCount(3);
    await expect(page.getByText("Boceto sin publicar")).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("filtra el portfolio solo por categorías con trabajos publicados", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    const filters = page.getByRole("group", { name: "Filtrar trabajos por categoría" });
    await expect(filters.getByRole("button", { name: /Bocetos/ })).toHaveCount(0);
    await filters.getByRole("button", { name: /Oriental/ }).click();
    await expect(filters.getByRole("button", { name: /Oriental/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#trabajos ul li")).toHaveCount(2);
  });

  test("abre el visor, pasa de foto y cierra", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await page.locator("#trabajos ul li a").first().click();
    const viewer = page.getByRole("dialog");
    await expect(viewer.getByRole("heading", { name: "Tigre" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByRole("heading", { name: "Pagoda" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(viewer.getByRole("heading", { name: "Buda" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/artist/${studio.slug}$`));
  });

  test("desde el visor abre la ficha de un trabajo y vuelve", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await page.locator("#trabajos ul li a").first().click();
    await page.getByRole("dialog").getByRole("link", { name: "Ver ficha" }).click();
    await expect(page).toHaveURL(new RegExp(`/artist/${studio.slug}/work/`));
    await expect(page.getByRole("link", { name: "Quiero algo así" })).toBeVisible();
    await page.getByRole("link", { name: "← Volver a trabajos" }).click();
    await expect(page).toHaveURL(new RegExp(`/artist/${studio.slug}`));
    // De vuelta en la página, el visor no queda abierto ni bloquea el desplazamiento.
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
  });

  test("el menú se esconde al bajar y vuelve al subir", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    const header = page.locator("header").first();
    // Si la rueda llega antes de que la página hidrate, ese primer scroll no se escucha: se insiste.
    await expect(async () => {
      await page.mouse.wheel(0, 600);
      await expect(header).toHaveAttribute("data-hidden", "true", { timeout: 1000 });
    }).toPass();
    await page.mouse.wheel(0, -400);
    await expect(header).not.toHaveAttribute("data-hidden");
  });

  test("el menú lleva a la sección deslizando la página", async ({ page }) => {
    await page.goto(`/artist/${studio.slug}`);
    await page.evaluate(() => {
      (window as unknown as { scrollPositions: number[] }).scrollPositions = [];
      addEventListener("scroll", () => (window as unknown as { scrollPositions: number[] }).scrollPositions.push(scrollY));
    });
    await page.getByRole("link", { name: "Iniciar proyecto" }).click();
    await expect(page.locator("#contacto")).toBeInViewport();
    // Un salto directo deja un solo evento de scroll; deslizando pasa por varias posiciones.
    const positions = await page.evaluate(() => (window as unknown as { scrollPositions: number[] }).scrollPositions);
    expect(positions.length).toBeGreaterThan(3);
  });

  test("con «reducir movimiento» el menú salta directo a la sección", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/artist/${studio.slug}`);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  });

  test("los links tienen imagen de vista previa para compartir", async ({ page, request }) => {
    await page.goto(`/artist/${studio.slug}`);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toContain(`/artist/${studio.slug}/opengraph-image`);
    const response = await request.get(new URL(ogImage!).pathname + new URL(ogImage!).search);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });

  test("un tatuador, un trabajo inexistente o un borrador devuelven 404", async ({ page }) => {
    expect((await page.goto("/artist/no-existe"))?.status()).toBe(404);
    expect((await page.goto(`/artist/${studio.slug}/work/00000000-0000-4000-8000-000000000000`))?.status()).toBe(404);
    expect((await page.goto(`/artist/${studio.slug}/work/no-es-un-uuid`))?.status()).toBe(404);
    expect((await page.goto(`/artist/${studio.slug}/work/${studio.workIds[3]}`))?.status()).toBe(404);
  });

  test("si falta una foto muestra un reemplazo en vez de una imagen rota", async ({ page }) => {
    await page.route("**/_next/image**", (route) => route.fulfill({ status: 404 }));
    await page.goto(`/artist/${studio.slug}/work/${studio.workIds[0]}`);
    await expect(page.getByText("Imagen no disponible").first()).toBeVisible();
  });
});
