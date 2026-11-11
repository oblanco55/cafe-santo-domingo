import { test, expect } from "@playwright/test";

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `e2e.${unique}@example.com`;
const password = "E2E-Passw0rd!";

test.describe("Autenticación", () => {
  test.beforeEach(async ({ page }) => {
    // IP virtual única por test → bucket rate-limit aislado
    const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });
  });

  test("registro + sesión + recuperación de sesión por cierre + login", async ({ page }) => {
    // 1. Registro con datos únicos
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Usuario E2E");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByLabel(/Acepto los/i).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // 2. Debe llegar a /panel y ver "Hola"
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByText(/Hola,/)).toBeVisible();

    // 3. Recargar y seguir en /panel (sesión persistida en cookie)
    await page.reload();
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByText(/Hola,/)).toBeVisible();

    // 4. Cerrar sesión → /panel redirige a /login
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    const signOutResponse = await page.waitForResponse(
      (res) => res.url().includes("/api/auth/signout"),
      { timeout: 15000 }
    ).catch(() => null);
    await expect
      .poll(() => signOutResponse !== null || !page.url().includes("/panel"), { timeout: 15000, message: "esperando sign-out" })
      .toBe(true);
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login/);

    // 5. Login con la misma cuenta → /panel
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByText(/Hola,/)).toBeVisible();
  });
});
