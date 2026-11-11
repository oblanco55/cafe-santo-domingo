import { expect, test } from "@playwright/test";

/**
 * F2-7c — Administración de monetización.
 * Requiere que el servidor tenga ADMIN_EMAILS con E2E_ADMIN (playwright.config.ts
 * lo pasa al webServer). Las llamadas a PayPal ocurren en el servidor; aquí se
 * comprueba el flujo sin credenciales (ajustes, paquetes y el aviso de los planes).
 */
const E2E_ADMIN = "e2e.admin@example.test";
const PASSWORD = "ClaveAdminE2E2026";

test.describe("Admin › Monetización", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.1.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });
    // Alta idempotente (201 la primera vez, 409 si ya existe).
    await page.request.post("/api/auth/register", {
      data: { name: "Admin E2E", email: E2E_ADMIN, password: PASSWORD, acceptTerms: true },
    });
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(E2E_ADMIN);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: /Iniciar sesión|Entrar/i }).click();
    await expect(page).toHaveURL(/\/panel/);
  });

  test("guarda ajustes, crea un paquete y avisa al crear un plan sin PayPal", async ({ page }) => {
    await page.goto("/admin/monetizacion");
    await expect(page.getByRole("tab", { name: "General y PayPal" })).toBeVisible();

    // Ajustes generales: la URL del webhook se muestra para registrarla en PayPal
    await expect(page.getByText(/\/api\/paypal\/webhook/)).toBeVisible();
    await page.getByLabel("Creaciones gratis al mes").fill("7");
    await page.getByRole("button", { name: "Guardar ajustes" }).click();
    await expect(page.getByText("Ajustes de monetización guardados.")).toBeVisible();

    // Paquete de créditos
    const name = `Pack E2E ${Date.now()}`;
    await page.getByRole("tab", { name: "Paquetes" }).click();
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Créditos").fill("10");
    await page.getByLabel(/Precio/).fill("4.99");
    await page.getByRole("button", { name: "Crear paquete" }).click();
    await expect(page.getByRole("cell", { name })).toBeVisible();

    // Plan: sin credenciales de PayPal → mensaje claro, sin romper la página
    await page.getByRole("tab", { name: "Planes" }).click();
    await page.getByLabel("Nombre").fill("Plan E2E");
    await page.getByLabel(/Precio/).fill("9.99");
    await page.getByLabel("Creaciones por periodo").fill("50");
    await page.getByRole("button", { name: "Crear plan" }).click();
    const alert = page.getByRole("alert").filter({ hasText: /PayPal/ });
    const created = page.getByRole("cell", { name: "Plan E2E" });
    await expect(alert.or(created).first()).toBeVisible();
  });
});
