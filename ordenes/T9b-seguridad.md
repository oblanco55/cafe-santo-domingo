# ORDEN T9b — Tests sesión, precarga y seguridad (perfil: desarrollador-frontend). Breve; informe máx. 6 líneas. Si falla 2 veces, DETENTE.
HECHOS: tests/e2e/helpers.ts existe. API: POST /api/creations/{video|photo|carousel}, GET /api/auth/session, POST /api/auth/register.
1. tests/e2e/validacion-seguridad.spec.ts:
   (a) sesión entre modalidades: registerNewUser → genera una foto → ir a /panel → abrir /crear/video → URL sigue en /crear/video (no /login).
   (b) precarga: tras generar una foto, abrir /crear/carrusel → el select de país vale "MX" y la descripción no está vacía.
   (c) sin sesión: `request.post('/api/creations/photo', { data: {} })` → 401; page.goto('/panel') → URL termina en /login.
   (d) registro con role:'admin' en el body vía page.request.post('/api/auth/register', {data:{name:'X Y',email:<único>,password:'Clave1234',acceptTerms:true,role:'admin'}}) → 201; luego login por la UI con esas credenciales y `page.request.get('/api/auth/session')` → user.role === 'user'.
   (e) validación servidor: con sesión, page.request.post('/api/creations/carousel', { data: { countryIso:'MX', offerType:'product', sector:'moda', description:'Descripción suficientemente larga del producto', platform:'instagram', slideCount: 4, aspectRatio:'1:1' } }) → 400.
2. npx playwright test tests/e2e/validacion-seguridad.spec.ts ; luego npm run test:e2e completo.
3. OBLIGATORIO: git add tests/e2e ordenes && git commit -m "test(T9): validación sesión, precarga y seguridad" && git push origin main.
