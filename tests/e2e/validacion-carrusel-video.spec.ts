import { expect, test, type Page } from "@playwright/test";
import { registerNewUser, fillCommon } from "./helpers";

/**
 * Navega desde el panel a la modalidad indicada.
 * (panel → tarjeta con el nombre de la modalidad → /crear/[type])
 */
async function goModality(page: Page, name: string) {
  const card = page.getByRole("link").filter({ hasText: name }).first();
  await card.click();
  await expect(page).toHaveURL(/\/crear\//);
}

test.describe("Carrusel 3/5/7 y video 15/30/45 (T9a2)", () => {
  test.beforeEach(async ({ page }) => {
    // IP virtual única por test → bucket rate-limit aislado
    const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });
  });

  for (const n of [3, 5, 7]) {
    test(`carrusel ${n} láminas → resultado con ${n} láminas`, async ({ page }) => {
      await registerNewUser(page);
      await goModality(page, "Carrusel");
      await expect(page).toHaveURL(/\/crear\/carrusel$/);

      await fillCommon(page, "Producto");

      // ¿Cuántas láminas deseas? → n
      await page
        .getByRole("group", { name: "¿Cuántas láminas deseas?" })
        .getByRole("button", { name: String(n), exact: true })
        .click();

      // ¿Qué formato necesitas? → 1:1
      const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
      await formatGroup.getByRole("button", { name: "1:1" }).first().click();

      const generate = page.getByRole("button", { name: "Generar guía de carrusel" });
      await expect(generate).toBeEnabled();
      await generate.click();

      // MockProvider responde al instante → cada lámina renderizada como h4 "Lámina N · ..."
      const slides = page.locator("h4").filter({ hasText: /^Lámina\s+\d/ });
      await expect(slides).toHaveCount(n, { timeout: 30_000 });

      // Sanity: la última lámina existe (índice n)
      await expect(page.locator("h4").filter({ hasText: `Lámina ${n} ` })).toBeVisible();
    });
  }

  for (const d of [15, 30, 45]) {
    test(`video ${d} s → guion con rango de tiempo hasta ${d} s`, async ({ page }) => {
      await registerNewUser(page);
      await goModality(page, "Guion de video");
      await expect(page).toHaveURL(/\/crear\/video$/);

      await fillCommon(page, "Producto");

      // ¿Cuánto debe durar? → "{d} s"
      await page
        .getByRole("group", { name: "¿Cuánto debe durar?" })
        .getByRole("button", { name: `${d} s`, exact: true })
        .click();

      const generate = page.getByRole("button", { name: "Generar guion" });
      await expect(generate).toBeEnabled();
      await generate.click();

      // La página muestra la duración elegida (rango final de la última escena).
      const body = page.locator("body");
      await expect(body).toContainText(`${d} s`, { timeout: 30_000 });
    });
  }
});
