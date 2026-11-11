# ORDEN T9 — Suite E2E de validación (Fase 7 de IDEA.md) (perfil: desarrollador-frontend)
REGLAS: breve, un archivo por llamada. SOLO añade tests en tests/e2e/ (no cambies código de la app; si un test revela un bug, NO lo arregles: repórtalo con el error exacto en el informe). Si un paso falla 2 veces, DETENTE.
Usa un helper compartido tests/e2e/helpers.ts: registerNewUser(page) con correo único, fillCommon(page, {offerType}) reutilizando los selectores de crear.spec.ts.
Crea tests/e2e/validacion.spec.ts con estos casos (AI_PROVIDER=mock):
1. Foto 1:1 producto → resultado muestra las 8 secciones ("Resumen creativo"…"Verificación") y bloque "Copy para publicar".
2. Foto 9:16 servicio → etiqueta del textarea dice "servicio"; resultado se genera.
3. Carrusel 3, 5 y 7 (test parametrizado) → se ven exactamente N tarjetas "Lámina " en el resultado.
4. Video 15/30/45 (parametrizado) → la última escena del resultado contiene "{duración} s".
5. Copiar: tras generar, "Copiar guía" y "Copiar copy" muestran "Copiado" (concede permisos clipboard-read/write en el contexto; lee el portapapeles y verifica que el copy NO contiene "Resumen creativo").
6. Error + reintento: page.route('**/api/creations/**') responde la 1ª vez 502 {error:{code:'AI_FAILED',message:'No pudimos generar un resultado válido. Intenta de nuevo.'}} y luego continúa (route.continue()). Verifica que aparece el mensaje, los valores del formulario siguen ahí, y "Reintentar" produce el resultado.
7. Persistencia/precarga: tras una creación, volver al panel y abrir otra modalidad → país, sector y descripción vienen precargados.
8. Sesión entre modalidades: crear foto → "Crear otro"/volver al panel → abrir video → sigue autenticado (no redirige a /login).
9. Seguridad: sin sesión, POST /api/creations/photo → 401; /panel → redirige a /login; registro con role:'admin' en el body → la sesión resultante NO es admin (GET /api/auth/session → role 'user').
10. Validación servidor: POST /api/creations/carousel con slideCount 4 (con sesión, vía page.request) → 400.
Ejecuta: npm run test:e2e (desktop y mobile). Informe máx. 15 líneas: tabla caso → resultado real; cualquier fallo con su mensaje exacto.
OBLIGATORIO al final (aunque haya fallos, sin ocultarlos): git add tests/e2e ordenes && git commit -m "test(T9): suite E2E de validación" && git push origin main.
