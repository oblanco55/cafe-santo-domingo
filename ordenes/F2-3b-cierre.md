# ORDEN F2-3b — Cerrar F2-3 (perfil: desarrollador-backend). Breve; un archivo por llamada; informe máx. 10 líneas. Si un paso falla 2 veces, DETENTE.
Contexto: ordenes/F2-3-api-admin.md. Tu ejecución anterior se interrumpió (exit 130) y dejó SIN COMMIT: src/app/api/admin/{users,users/[id],creations,creations/[id],legal,legal/[slug],settings,cleanup}/route.ts, src/lib/{admin,admin-utils,audit}.ts, src/lib/contracts/admin.ts. `npx tsc --noEmit` pasa. Ejecuta `git status` y `ls -R src/app/api/admin` primero. NO reescribas lo que existe salvo lo indicado.
CORRECCIONES OBLIGATORIAS (revisión de Claude):
1. ELIMINA src/app/api/admin/cleanup/route.ts y la función cleanupCreations de src/lib/admin.ts: no se pidió, borra datos y la política de retención no está aprobada.
2. Permisos: en TODAS las rutas admin, un ForbiddenError de requireAdmin() debe responder 403 (code FORBIDDEN), no 500. Crea un helper único (p. ej. withAdmin(handler) o handleAuthError(e)) y úsalo en todas.
FALTA (puntos de F2-3):
3. GET /api/admin/metrics?days=30 (punto 1).
4. Rutas de IA (punto 5): ai/presets (GET), ai/providers (GET, POST), ai/providers/[id] (PATCH, DELETE), ai/providers/[id]/test (POST con testProvider de src/lib/ai/test-connection.ts). La clave nunca se devuelve: solo maskSecret.
5. Pública: GET /api/legal/[slug] sin auth (punto 4).
6. La ruta POST /api/creations/[type] debe leer el límite limits.creationsPer10Min de AppSetting (caché 60 s, default 20) (punto 6).
7. Tests Vitest del punto 7 (403 para user en cada grupo, PATCH sobre uno mismo → 400, clave cifrada y enmascarada, PUT legal sube versión y GET público la devuelve, audit log creado).
8. npx tsc --noEmit ; npm run lint ; npm test ; npm run build.
9. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-3): API de administración con auditoría" && git push origin main.
