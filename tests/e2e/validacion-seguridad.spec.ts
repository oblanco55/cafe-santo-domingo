import { expect, test, type Page } from "@playwright/test";
import { registerNewUser, fillCommon, DESCRIPTION } from "./helpers";

/**
 * (a) + (b) compartido: registrar → generar una foto → devolver la página.
 * El helper de registro fija un x-forwarded-for único por test para no
 * agotar el rate-limit del backend; se conserva en toda la página.
 */
async function generatePhoto(page: Page) {
  const photoCard = page.getByRole("link").filter({ hasText: "Fotografía" }).first();
  await photoCard.click();
  await expect(page).toHaveURL(/\/crear\/foto$/);
  await fillCommon(page, "Producto");
  const formatGroup = page.getByRole("group", { name: "¿Qué formato necesitas?" });
  await formatGroup.getByRole("button", { name: "1:1" }).first().click();
  const generate = page.getByRole("button", { name: "Generar guía fotográfica" });
  await expect(generate).toBeEnabled();
  await generate.click();
  const body = page.locator("body");
  await expect(body).toContainText("Resumen creativo", { timeout: 30_000 });
}

test.describe("Sesión, precarga y seguridad (T9b)", () => {
  test.beforeEach(async ({ page }) => {
    // IP virtual única por test → bucket rate-limit aislado
    const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });
  });

  test("(a) sesión persiste entre modalidades: foto → panel → video sin ir a /login", async ({ page }) => {
    await registerNewUser(page);
    await generatePhoto(page);

    // Volver al panel
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/panel($|\/)/);

    // Abrir la modalidad de video: debe quedar en /crear/video (no /login)
    const videoCard = page.getByRole("link").filter({ hasText: "Guion de video" }).first();
    await videoCard.click();
    await expect(page).toHaveURL(/\/crear\/video$/);
    expect(page.url()).not.toContain("/login");
  });

  test("(b) precarga tras generar foto: /crear/carrusel → país = MX y descripción no vacía", async ({ page }) => {
    await registerNewUser(page);
    await generatePhoto(page);

    await page.goto("/crear/carrusel");
    await expect(page).toHaveURL(/\/crear\/carrusel$/);

    // El select de país queda precargado con "MX" (BusinessProfile upsert del backend)
    await expect(page.getByLabel("¿En qué país resides?")).toHaveValue("MX");
    // La descripción no está vacía
    const desc = page.getByLabel(/^Háblanos un poco/i);
    await expect(desc).not.toHaveValue("");
    await expect(desc).toHaveValue(DESCRIPTION);
  });

  test("(c) sin sesión: POST /api/creations/photo → 401 y /panel redirige a /login", async ({ page, request }) => {
    // Contexto completamente limpio: sin cookies de sesión
    const response = await request.post("/api/creations/photo", { data: {} });
    await expect(response.status(), "POST sin sesión debe responder 401").toBe(401);

    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login\/?$/);
  });

  test("(d) role:'admin' en el body de registro → 201 pero la sesión siempre es role 'user'", async ({ context, page }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `e2e.attack.${unique}@example.com`;

    // context.request: sin headers extra de page → bucket de rate-limit limpio
    const reg = await context.request.post("/api/auth/register", {
      data: { name: `Atacante ${unique}`, email, password: "Clave1234", acceptTerms: true, role: "admin" },
      headers: { "x-forwarded-for": `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` },
    });
    await expect(reg.status(), "el registro debe aceptar y devolver 201 (zod ignora el campo role)").toBe(201);

    // Login por la UI con esas credenciales
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("Clave1234");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/panel($|\/)/);

    // La sesión expone role === 'user' (nunca 'admin')
    const sessionRes = await page.request.get("/api/auth/session");
    await expect(sessionRes.status()).toBe(200);
    const session = await sessionRes.json();
    expect(session.user.role, "el rol de la sesión debe ser 'user'").toBe("user");
  });

  test("(e) validación servidor: carrusel con slideCount 4 → 400", async ({ context, page }) => {
    // context.request: evita headers extra de page que podrían agotar el rate-limit
    await registerNewUser(page);

    const res = await context.request.post("/api/creations/carousel", {
      data: {
        countryIso: "MX",
        offerType: "product",
        sector: "moda",
        description: "Vendo vestidos de algodón natural para verano, con corte holgado y colores suaves de inspiración mediterránea.",
        platform: "instagram",
        slideCount: 4,
        aspectRatio: "1:1",
      },
    });
    await expect(res.status(), "slideCount fuera de 3/5/7 debe responder 400").toBe(400);
  });
});
