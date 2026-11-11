import { expect, test } from "@playwright/test";
import { registerNewUser, fillCommon } from "./helpers";

test.describe("Fotografía estática (T9)", () => {
  test.beforeEach(async ({ page }) => {
    // IP virtual única por test → bucket rate-limit aislado
    const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });
  });

  test("foto 1:1 Producto → bloques + copy", async ({ page }) => {
    await registerNewUser(page);

    // Panel → tarjeta Fotografía
    const photoCard = page
      .getByRole("link")
      .filter({ hasText: "Fotografía" })
      .first();
    await photoCard.click();
    await expect(page).toHaveURL(/\/crear\/foto$/);

    await fillCommon(page, "Producto");

    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    const generate = page.getByRole("button", { name: "Generar guía fotográfica" });
    await expect(generate).toBeEnabled();
    await generate.click();

    // MockProvider responde al instante → página con los bloques clave
    const body = page.locator("body");
    const timeout = { timeout: 30_000 };
    await expect(body).toContainText("Resumen creativo", timeout);
    await expect(body).toContainText("Iluminación", timeout);
    await expect(body).toContainText("Verificación", timeout);
    await expect(body).toContainText("Copy para publicar", timeout);
  });

  test("foto 9:16 Servicio → etiqueta servicio + resultado", async ({ page }) => {
    await registerNewUser(page);

    // Panel → tarjeta Fotografía
    const photoCard = page
      .getByRole("link")
      .filter({ hasText: "Fotografía" })
      .first();
    await photoCard.click();
    await expect(page).toHaveURL(/\/crear\/foto$/);

    await fillCommon(page, "Servicio");

    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "Vertical Story 9:16" }).first().click();

    // El label (sr-only) del textarea refleja "servicio"
    const descLabelEl = page.locator("label").filter({ hasText: /Háblanos un poco de tu servicio/ }).first();
    await expect(descLabelEl).toContainText("servicio");

    const generate = page.getByRole("button", { name: "Generar guía fotográfica" });
    await expect(generate).toBeEnabled();
    await generate.click();

    // El resultado aparece (cabecera h2 + al menos un bloque)
    const successTitle = page.locator("h2").first();
    await expect(successTitle).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Resumen creativo").first()).toBeVisible();
  });
});
