import { expect, test, type Page } from "@playwright/test";

const password = "E2E-Passw0rd!";

/** Descripción válida (>= 20 caracteres) reutilizada por ambos tests. */
const DESCRIPTION =
  "Vendo velas aromáticas artesanales de lavanda y vainilla, hechas en pequeños lotes con frascos de vidrio reutilizable. Busco destacar el acabado hecho a mano.";

/** Registra el usuario con un correo único (por test) y espera llegar a /panel. */
async function registerNewUser(page: Page) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e.crear.${unique}@example.com`;

  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill(`Usuario E2E ${unique}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByLabel(/Acepto los/i).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
  await expect(page.getByText(/Hola,/)).toBeVisible();
}

/**
 * Llena los cuatro campos comunes obligatorios, en cualquier orden:
 * país, oferta (Producto), sector, descripción y plataforma (Instagram).
 */
async function fillCommon(page: Page) {
  await page.getByLabel("¿En qué país resides?").selectOption("MX");
  await page.getByRole("button", { name: "Producto", exact: true }).click();
  await page.getByLabel("¿A qué sector pertenece?").selectOption("gastronomia");
  await page.getByLabel(/^Háblanos un poco/i).fill(DESCRIPTION);
  await page
    .getByRole("group", { name: "¿Para qué plataforma es la publicación?" })
    .getByRole("button", { name: "Instagram", exact: true })
    .click();
}

test.describe("Formularios de creación (T7)", () => {
  test.beforeEach(async ({ page }) => {
    // IP virtual única por test → bucket rate-limit aislado
    const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });
  });

  test("carrusel: 7 láminas → botón habilitado → guía con «index: 7»", async ({
    page,
  }) => {
    // Usuario nuevo (correo único por test) → registro → panel
    await registerNewUser(page);

    // Panel → tarjeta Carrusel
    const carouselCard = page
      .getByRole("link")
      .filter({ hasText: "Carrusel" })
      .first();
    await carouselCard.click();
    await expect(page).toHaveURL(/\/crear\/carrusel$/);

    await fillCommon(page);

    // Específicos: 7 láminas + formato (la estructura ya trae default)
    await page
      .getByRole("group", { name: "¿Cuántas láminas deseas?" })
      .getByRole("button", { name: "7", exact: true })
      .click();

    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    // El botón primario debe estar habilitado (esquema válido)
    const generate = page.getByRole("button", { name: "Generar guía de carrusel" });
    await expect(generate).toBeEnabled();

    await generate.click();

    // MockProvider responde al instante → vista de resultados estructurada
    // h2 de cabecera: "Guía de <tipo>: <sector>"
    const successHeader = page.locator("h2").first();
    await expect(successHeader).toBeVisible({ timeout: 30_000 });
    // Título generado por el mock: "Guía de carrusel: <sector>"
    await expect(successHeader).toHaveText(/Guía de/);

    // Cabecera: título + concepto + chips de metadatos
    const chipPlatform = page.getByText("Instagram").first();
    await expect(chipPlatform).toBeVisible();
    const chipAspect = page.getByText("1:1").first();
    await expect(chipAspect).toBeVisible();

    // Configuración general del carrusel
    const generalSetup = page.locator("h3").filter({ hasText: "Estilo y configuración general" });
    await expect(generalSetup).toBeVisible();
    const palette = page.getByText(/Paleta de color/i);
    await expect(palette).toBeVisible();

    // Las 7 láminas presentes en la vista
    for (let i = 1; i <= 7; i++) {
      const slideHeading = page
        .locator("h4")
        .filter({ hasText: new RegExp(`^Lámina\\s+${i}\\b`) });
      await expect(slideHeading).toBeVisible();
    }

    // Texto sobre la imagen (última lámina)
    const overlayBlocks = page.getByText(/Texto sobre la imagen/i);
    await expect(overlayBlocks.first()).toBeVisible();

    // Copy para publicar (bloque separado)
    const copySection = page.locator("h3").filter({ hasText: "Copy para publicar" });
    await expect(copySection).toBeVisible();
    const caption = page.locator("p.font-medium.text-brand-orange").first();
    await expect(caption).toBeVisible();

    // Botones funcionales
    const copyGuideBtn = page.getByRole("button", { name: /Copiar guía/i });
    await expect(copyGuideBtn).toBeVisible();
    const copyCopyBtn = page.getByRole("button", { name: /Copiar copy/i });
    await expect(copyCopyBtn).toBeVisible();
  });

  test("fotografía: descripción corta (< 20) → botón deshabilitado", async ({
    page,
  }) => {
    // Usuario nuevo (correo único por test) → registro → panel
    await registerNewUser(page);

    // Panel → tarjeta Fotografía
    const photoCard = page
      .getByRole("link")
      .filter({ hasText: "Fotografía" })
      .first();
    await photoCard.click();
    await expect(page).toHaveURL(/\/crear\/foto$/);

    // Todos los campos obligatorios EXCEPTO la descripción
    await page.getByLabel("¿En qué país resides?").selectOption("MX");
    await page.getByRole("button", { name: "Producto", exact: true }).click();
    await page.getByLabel("¿A qué sector pertenece?").selectOption("gastronomia");
    await page
      .getByRole("group", { name: "¿Para qué plataforma es la publicación?" })
      .getByRole("button", { name: "Instagram", exact: true })
      .click();
    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    // Descripción < 20 caracteres → botón DESHABILITADO
    await page.getByLabel(/^Háblanos un poco/i).fill("Velas artesanales.");
    await expect(
      page.getByRole("button", { name: "Generar guía fotográfica" })
    ).toBeDisabled();

    // Y al alcanzar el mínimo (>= 20) el botón se habilita de nuevo
    await page.getByLabel(/^Háblanos un poco/i).fill(DESCRIPTION);
    await expect(
      page.getByRole("button", { name: "Generar guía fotográfica" })
    ).toBeEnabled();
  });

  test("fotografía: campos válidos → 8 bloques + copy + botones", async ({
    page,
  }) => {
    // Usuario nuevo → registro → panel
    await registerNewUser(page);

    // Panel → tarjeta Fotografía
    const photoCard = page
      .getByRole("link")
      .filter({ hasText: "Fotografía" })
      .first();
    await photoCard.click();
    await expect(page).toHaveURL(/\/crear\/foto$/);

    // Todos los campos obligatorios (descripción válida)
    await fillCommon(page);
    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    // El botón primario debe estar habilitado
    const generate = page.getByRole("button", { name: "Generar guía fotográfica" });
    await expect(generate).toBeEnabled();

    await generate.click();

    // MockProvider responde al instante → vista de resultados estructurada
    const successTitle = page.locator("h2").first();
    await expect(successTitle).toBeVisible({ timeout: 30_000 });

    // Chips de metadatos (plataforma + formato)
    await expect(page.getByText("Instagram").first()).toBeVisible();
    await expect(page.getByText("1:1").first()).toBeVisible();

    // Los 8 bloques numerados de fotografía
    const expectedBlockTitles = [
      "Resumen creativo",
      "Preparación",
      "Composición",
      "Iluminación",
      "Fondo y ambientación",
      "Captura",
      "Formato y texto",
      "Verificación",
    ];
    for (const title of expectedBlockTitles) {
      const blockHeading = page
        .locator("h3")
        .filter({ hasText: title })
        .first();
      await expect(blockHeading).toBeVisible();
    }

    // Copy para publicar (bloque separado)
    const copySection = page.locator("h3").filter({
      hasText: "Copy para publicar",
    });
    await expect(copySection).toBeVisible();

    const caption = page
      .locator("p.font-medium.text-brand-orange")
      .first();
    await expect(caption).toBeVisible();

    // Botones funcionales
    const copyGuideBtn = page.getByRole("button", { name: /Copiar guía/i });
    await expect(copyGuideBtn).toBeVisible();
    const copyCopyBtn = page.getByRole("button", { name: /Copiar copy/i });
    await expect(copyCopyBtn).toBeVisible();
    const newBtn = page.getByRole("button", { name: /Crear otro/i });
    await expect(newBtn).toBeVisible();
  });

  test("slug desconocido: GET /crear/xyz responde 404", async ({ page }) => {
    await registerNewUser(page);
    const res = await page.goto("/crear/xyz");
    expect(res?.status()).toBe(404);
  });
});
