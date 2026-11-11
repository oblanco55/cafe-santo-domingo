# ORDEN T9a — Suite E2E de validación (Fase 7 de IDEA.md) (perfil: desarrollador-frontend)
REGLAS: breve, un archivo por llamada. SOLO añade tests en tests/e2e/ (no cambies código de la app; si un test revela un bug, NO lo arregles: repórtalo con el error exacto en el informe). Si un paso falla 2 veces, DETENTE.
Usa un helper compartido tests/e2e/helpers.ts: registerNewUser(page) con correo único, fillCommon(page, {offerType}) reutilizando los selectores de crear.spec.ts.
ATENCIÓN: tu ejecución anterior de T9 NO creó estos tests (solo corrió los existentes). El archivo DEBE existir al final y Claude lo comprobará.
Crea tests/e2e/helpers.ts y tests/e2e/validacion-a.spec.ts con estos casos (AI_PROVIDER=mock):
1. Foto 1:1 producto → resultado muestra las 8 secciones ("Resumen creativo"…"Verificación") y bloque "Copy para publicar".
2. Foto 9:16 servicio → etiqueta del textarea dice "servicio"; resultado se genera.
3. Carrusel 3, 5 y 7 (test parametrizado) → se ven exactamente N tarjetas "Lámina " en el resultado.
4. Video 15/30/45 (parametrizado) → la última escena del resultado contiene "{duración} s".
5. Copiar: tras generar, "Copiar guía" y "Copiar copy" muestran "Copiado" (concede permisos clipboard-read/write en el contexto; lee el portapapeles y verifica que el copy NO contiene "Resumen creativo").
Ejecuta: npm run test:e2e (desktop y mobile). Informe máx. 15 líneas: tabla caso → resultado real; cualquier fallo con su mensaje exacto.
OBLIGATORIO al final (aunque haya fallos, sin ocultarlos): git add tests/e2e ordenes && git commit -m "test(T9): suite E2E de validación (parte A)" && git push origin main.
