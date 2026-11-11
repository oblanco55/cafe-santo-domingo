import { expect, type Page } from "@playwright/test";

const password = "E2E-Passw0rd!";

/** Descripción válida (>= 20 caracteres) reutilizada por los tests. */
export const DESCRIPTION =
  "Vendo velas aromáticas artesanales de lavanda y vainilla, hechas en pequeños lotes con frascos de vidrio reutilizable. Busco destacar el acabado hecho a mano.";

/**
 * Registra el usuario con un correo único (por test) y espera llegar a /panel.
 * Envía x-forwarded-for único por test para que el rate-limit del backend
 * (10 intentos / 10 min por IP) no bloquee la suite: en local todos los tests
 * comparten la IP 'unknown' (sin proxy), así que 10 registros agotan el
 * bucket. Con x-forwarded-for único por test, cada test tiene su propio bucket
 * y la suite completa (8 registros) pasa sin tocar el límite.
 */
export async function registerNewUser(page: Page) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e.validacion.${unique}@example.com`;
  const fwdIp = `10.0.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`; // IP virtual única por test

  await page.setExtraHTTPHeaders({ "x-forwarded-for": fwdIp });

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
 * Llena los campos comunes obligatorios en cualquier modalidad:
 * país (MX), oferta (Producto | Servicio), sector (gastronomia),
 * descripción (>= 20 chars) y plataforma (Instagram).
 */
export async function fillCommon(
  page: Page,
  offerType: "Producto" | "Servicio"
) {
  await page.getByLabel("¿En qué país resides?").selectOption("MX");
  await page.getByRole("button", { name: offerType, exact: true }).click();
  await page.getByLabel("¿A qué sector pertenece?").selectOption("gastronomia");
  await page.getByLabel(/^Háblanos un poco/i).fill(DESCRIPTION);
  await page
    .getByRole("group", { name: "¿Para qué plataforma es la publicación?" })
    .getByRole("button", { name: "Instagram", exact: true })
    .click();
}
