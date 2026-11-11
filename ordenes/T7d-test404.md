# ORDEN T7d — Corregir test 404 y cerrar T7 (perfil: desarrollador-frontend). Breve; informe máx. 6 líneas. Si falla 2 veces, DETENTE.
Claude verificó con curl: la APP es correcta (/crear/xyz con sesión → 404; sin sesión → 307 a /login). El test "slug desconocido" de tests/e2e/crear.spec.ts falla (recibe 200) porque usa `request` SIN sesión y sigue la redirección al login.
1. Cambia ese test para usar `page`: registerNewUser(page) y luego `const res = await page.goto('/crear/xyz'); expect(res?.status()).toBe(404);`. No toques nada más.
2. npm run test:e2e (los 8 deben pasar) ; npx tsc --noEmit ; npm test.
3. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(T7): formularios contextuales por modalidad" && git push origin main.
