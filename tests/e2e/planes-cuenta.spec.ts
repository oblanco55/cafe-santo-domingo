import { expect, test } from "@playwright/test";
import { fillCommon, registerNewUser } from "./helpers";

/**
 * F2-7d — Planes, Mi cuenta y límite gratuito. Las APIs de cobro se simulan
 * con page.route (no se contacta con PayPal).
 */
const CATALOG = {
  enabled: true,
  freeCreationsPerMonth: 5,
  currency: "USD",
  paypal: { clientId: null, mode: "sandbox" },
  plans: [
    { id: "pl1", name: "Plan Pro", description: "Para negocios activos", priceCents: 999, currency: "USD", interval: "month", creationsPerPeriod: null, paypalPlanId: "P-1" },
  ],
  packs: [{ id: "pk1", name: "Paquete 20", credits: 20, priceCents: 1499, currency: "USD" }],
};

test.describe("Planes y Mi cuenta (F2-7d)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.2.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });
  });

  test("402 al crear muestra «Ver planes» y conserva el formulario", async ({ page }) => {
    await registerNewUser(page);
    await page.route("**/api/creations/photo", (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "PAYMENT_REQUIRED", message: "Alcanzaste tu límite gratuito. Elige un plan o un paquete de créditos para seguir creando." } }),
      }),
    );
    await page.goto("/crear/foto");
    await fillCommon(page, "Producto");
    await page.getByRole("group", { name: "¿Qué formato necesitas?" }).getByRole("button", { name: "1:1" }).first().click();
    await page.getByRole("button", { name: "Generar guía fotográfica" }).click();

    await expect(page.getByText("Alcanzaste tu límite gratuito")).toBeVisible();
    const link = page.getByRole("link", { name: "Ver planes" });
    await expect(link).toHaveAttribute("href", "/planes");
    await expect(page.getByRole("button", { name: "Generar guía fotográfica" })).toBeVisible();
  });

  test("/planes lista la capa gratuita, los planes y los paquetes", async ({ page }) => {
    await page.route("**/api/billing/catalog", (route) => route.fulfill({ json: CATALOG }));
    await page.goto("/planes");
    await expect(page.getByText("5 creaciones al mes sin coste")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plan Pro" })).toBeVisible();
    await expect(page.getByText("Creaciones ilimitadas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Paquete 20" })).toBeVisible();
    await expect(page.getByText("20 créditos")).toBeVisible();
    // Sin sesión: invita a iniciar sesión en lugar de mostrar PayPal
    await expect(page.getByRole("link", { name: "Inicia sesión para comprar" }).first()).toBeVisible();
  });

  test("/planes con cobros desactivados avisa de que todo es gratis", async ({ page }) => {
    await page.route("**/api/billing/catalog", (route) => route.fulfill({ json: { ...CATALOG, enabled: false } }));
    await page.goto("/planes");
    await expect(page.getByText("Por ahora todas las creaciones son gratuitas.")).toBeVisible();
  });

  test("/cuenta muestra uso del mes, créditos y suscripción", async ({ page }) => {
    await registerNewUser(page);
    await page.route("**/api/billing/usage", (route) =>
      route.fulfill({
        json: {
          monetizationEnabled: true,
          freeUsedThisMonth: 3,
          freeQuota: 5,
          credits: 12,
          subscription: { plan: "Plan Pro", status: "ACTIVE", used: 4, quota: null, periodEnd: "2030-01-15T00:00:00Z" },
        },
      }),
    );
    await page.goto("/cuenta");
    await expect(page.getByRole("heading", { name: "Mi cuenta" })).toBeVisible();
    await expect(page.getByText("de 5")).toBeVisible();
    await expect(page.getByText("12", { exact: true })).toBeVisible();
    await expect(page.getByText("Plan Pro")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar suscripción" })).toBeVisible();
  });

  test("/cuenta sin sesión redirige a /login", async ({ page }) => {
    await page.goto("/cuenta");
    await expect(page).toHaveURL(/\/login/);
  });
});
