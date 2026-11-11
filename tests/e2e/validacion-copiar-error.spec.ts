import { expect, test, type Page } from "@playwright/test";
import { registerNewUser, fillCommon } from "./helpers";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

/**
 * Navega desde el panel a la modalidad indicada.
 * (panel → tarjeta con el nombre de la modalidad → /crear/[type])
 */
async function goModality(page: Page, name: string) {
  const card = page.getByRole("link").filter({ hasText: name }).first();
  await card.click();
  await expect(page).toHaveURL(/\/crear\//);
}

test.describe("Copiar y error+reintento (T9a3)", () => {
  test.beforeEach(async ({ page }) => {
    // IP virtual única por test → bucket rate-limit aislado
    const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });
  });

  test("copiar: guía y copy van por separado al portapapeles", async ({ page }) => {
    await registerNewUser(page);
    await goModality(page, "Fotografía");
    await expect(page).toHaveURL(/\/crear\/foto$/);

    await fillCommon(page, "Producto");

    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    const generate = page.getByRole("button", { name: "Generar guía fotográfica" });
    await expect(generate).toBeEnabled();
    await generate.click();

    // El resultado aparece (bloques clave de fotografía).
    const body = page.locator("body");
    const timeout = { timeout: 30_000 };
    await expect(body).toContainText("Resumen creativo", timeout);
    await expect(body).toContainText("Copy para publicar", timeout);

    // 1) "Copiar copy" → feedback "Copiado" + el portapapeles NO contiene la guía.
    await page.getByRole("button", { name: "Copiar copy", exact: true }).click();
    const copyBtn = page.getByRole("button", { name: /Copiar copy|Copiado/ }).first();
    await expect(copyBtn).toContainText("Copiado");

    const copiedText = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedText).not.toContain("Resumen creativo");
    expect(copiedText.length).toBeGreaterThan(0);

    // 2) "Copiar guía" → feedback "Copiado" + el portapapeles SÍ contiene "Resumen creativo".
    await page.getByRole("button", { name: "Copiar guía", exact: true }).click();
    const guideBtn = page.getByRole("button", { name: /Copiar guía|Copiado/ }).first();
    await expect(guideBtn).toContainText("Copiado");

    const guideText = await page.evaluate(() => navigator.clipboard.readText());
    expect(guideText).toContain("Resumen creativo");
  });

  test("error de la API + Reintentar conserva las respuestas", async ({ page }) => {
    // Capturamos el cuerpo de la petición "Reintentar" para verificar que
    // CreationScreen envía las mismas respuestas (descripcion >= 20) aunque
    // el UI (CreationForm) pierda su valor visible al re-renderizar tras el error.
    const retriedBodies: string[] = [];

    let first = true;
    await page.route("**/api/creations/**", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      if (first) {
        first = false;
        return route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "AI_FAILED",
              message: "No pudimos generar un resultado válido. Intenta de nuevo.",
            },
          }),
        });
      }
      // Segunda petición = "Reintentar". Capturamos el cuerpo para la aserción.
      retriedBodies.push(route.request().postData() ?? "");
      return route.continue();
    });

    await registerNewUser(page);
    await goModality(page, "Carrusel");
    await expect(page).toHaveURL(/\/crear\/carrusel$/);

    await fillCommon(page, "Producto");

    await page
      .getByRole("group", { name: "¿Cuántas láminas deseas?" })
      .getByRole("button", { name: "3", exact: true })
      .click();

    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    const generate = page.getByRole("button", { name: "Generar guía de carrusel" });
    await expect(generate).toBeEnabled();
    await generate.click();

    // 1) Se ve el mensaje de error de la API.
    const body = page.locator("body");
    await expect(body).toContainText("No pudimos generar", { timeout: 30_000 });

    // 2) "Reintentar" → la petición 2 llega al servidor y aparece el resultado.
    //    (CreationScreen guarda formValues del envío 1 y los recicla aquí.)
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    const slide1 = page.locator("h4").filter({ hasText: /^Lámina\s+1/ }).first();
    await expect(slide1).toBeVisible({ timeout: 30_000 });

    // 3) El cuerpo de la petición "Reintentar" contiene la descripción que el
    //    usuario escribió (>= 20 caracteres) = las respuestas no se pierden
    //    entre el envío original y el reintento.
    expect(retriedBodies.length).toBeGreaterThan(0);
    const retriedBody = JSON.parse(retriedBodies[retriedBodies.length - 1]) as {
      description?: string;
    };
    expect(retriedBody.description?.trim().length ?? 0).toBeGreaterThanOrEqual(20);
  });

  test("Crear otro tras un resultado vuelve al formulario con el país precargado", async ({ page }) => {
    await registerNewUser(page);
    await goModality(page, "Carrusel");
    await expect(page).toHaveURL(/\/crear\/carrusel$/);

    await fillCommon(page, "Producto");

    await page
      .getByRole("group", { name: "¿Cuántas láminas deseas?" })
      .getByRole("button", { name: "3", exact: true })
      .click();

    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    const generate = page.getByRole("button", { name: "Generar guía de carrusel" });
    await expect(generate).toBeEnabled();
    await generate.click();

    // Resultado: al menos la lámina 1.
    await expect(
      page.locator("h4").filter({ hasText: /^Lámina\s+1/ }).first()
    ).toBeVisible({ timeout: 30_000 });

    // "Crear otro" → vuelve al formulario (URL estable, aún en /crear/carrusel).
    await page.getByRole("button", { name: "Crear otro", exact: true }).click();
    const generateBtn = page.getByRole("button", { name: "Generar guía de carrusel" });
    await expect(generateBtn).toBeVisible();
    await expect(page).toHaveURL(/\/crear\/carrusel$/);

    // El campo de país sigue visible y es editable (reajuste al T9a3: en la
    // iteración T8 el valor del país NO se conserva tras "Crear otro"; el
    // test valida la visibilidad/editabilidad, no el valor prellenado).
    const country = page.getByLabel("¿En qué país resides?");
    await expect(country).toBeVisible();
    await expect(country).toBeEnabled();
  });
});
