# ORDEN T9a3 — Tests copiar y error+reintento (perfil: desarrollador-frontend). Breve; informe máx. 6 líneas. Si falla 2 veces, DETENTE.
HECHOS: tests/e2e/helpers.ts existe. ResultView tiene botones "Copiar guía", "Copiar copy", "Editar respuestas", "Crear otro" y muestra "Copiado" tras copiar. CreationScreen muestra el mensaje de error de la API y un botón "Reintentar".
1. tests/e2e/validacion-copiar-error.spec.ts:
   (a) copiar: test.use({ permissions: ['clipboard-read','clipboard-write'] }) — solo en chromium; genera una foto; clic "Copiar copy" → visible "Copiado"; lee navigator.clipboard.readText() con page.evaluate y verifica que NO contiene "Resumen creativo"; clic "Copiar guía" → el portapapeles contiene "Resumen creativo".
   (b) error y reintento: let first = true; await page.route('**/api/creations/**', r => { if (first) { first = false; return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AI_FAILED', message: 'No pudimos generar un resultado válido. Intenta de nuevo.' } }) }); } return r.continue(); }); genera un carrusel → se ve "No pudimos generar"; el textarea de descripción conserva su valor; clic "Reintentar" → aparece "Lámina 1".
   (c) "Crear otro" tras un resultado vuelve al formulario y el país sigue precargado (MX).
2. npx playwright test tests/e2e/validacion-copiar-error.spec.ts.
3. OBLIGATORIO: git add tests/e2e ordenes && git commit -m "test(T9): validación copiar, error y reintento" && git push origin main.
