import { expect, test } from "@playwright/test";
import { registerNewUser, fillCommon, DESCRIPTION } from "./helpers";

test.describe("Mis creaciones, perfil y regenerar (F2-6b)", () => {
  test.beforeEach(async ({ page }) => {
    const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });
  });

  test("generar foto → /creaciones → regenerar → eliminar", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(120_000);
    await registerNewUser(page);

    // Navegar a /crear/foto y generar una guía
    await page.goto("/crear/foto");
    await fillCommon(page, "Producto");

    const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
    await formatGroup.getByRole("button", { name: "1:1" }).first().click();

    const generate = page.getByRole("button", { name: "Generar guía fotográfica" });
    await expect(generate).toBeEnabled();
    await generate.click();

    // Esperar el resultado
    const body = page.locator("body");
    await expect(body).toContainText("Resumen creativo", { timeout: 30_000 });

    // Ir a Mis creaciones
    await page.goto("/creaciones");
    await expect(page.locator("body")).toContainText("Fotografía", { timeout: 10_000 });

    // Click en la tarjeta → abre el detalle
    const card = page.getByRole("link").filter({ hasText: "Fotografía" }).first();
    await card.click();
    await expect(page).toHaveURL(/\/creaciones\/.+/, { timeout: 10_000 });

    // Ver ResultView
    await expect(body).toContainText("Resumen creativo", { timeout: 10_000 });

    // Regenerar variante
    const regenBtn = page.getByRole("button", { name: /Regenerar/ });
    await regenBtn.click();
    await expect(page.locator("body")).toContainText("Resumen creativo", { timeout: 15_000 });

    // Eliminar: el listener del dialog acepta automáticamente.
    page.once("dialog", (dialog) => dialog.accept());
    const deleteBtn = page.getByRole("button", { name: "Eliminar" });
    await deleteBtn.click();
    await page.waitForURL("**/creaciones", { timeout: 30_000 });
  });

  test("/perfil guarda y al recargar conserva el valor", async ({ page }) => {
    await registerNewUser(page);

    // Ir a Perfil
    await page.goto("/perfil");
    await expect(page.locator("body")).toContainText("Perfil del negocio");

    // Llenar el formulario (selectOption usa el value, no el label)
    await page.getByLabel("País").selectOption("MX");
    await page.getByLabel("Tipo de oferta").selectOption("product");
    await page.getByLabel("Sector").selectOption("gastronomia");
    await page.getByLabel(/Descripción/).fill(DESCRIPTION);

    // Guardar
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("body")).toContainText("Guardado", {
      timeout: 10_000,
    });

    // Recargar
    await page.reload();
    await expect(page.getByLabel("Sector")).toHaveValue("gastronomia", {
      timeout: 10_000,
    });
  });
});
