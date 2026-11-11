# ORDEN F2-3c — Rutas que faltan de F2-3 (perfil: desarrollador-backend). Breve; un archivo por llamada; informe máx. 8 líneas. Si un paso falla 2 veces, DETENTE.
HECHOS VERIFICADOS POR CLAUDE (commit 7efdcc8): existen src/app/api/admin/{users,users/[id],creations,creations/[id],legal,legal/[slug],settings,metrics}/route.ts con manejo 401/403 correcto; cleanup eliminado; 181 tests pasan. Ejecuta `ls -R src/app/api/admin` primero y reutiliza el mismo helper de permisos que usan esas rutas.
FALTA (de ordenes/F2-3-api-admin.md):
1. Rutas de IA (punto 5): src/app/api/admin/ai/presets/route.ts (GET → PROVIDER_PRESETS de src/lib/ai/presets.ts); ai/providers/route.ts (GET lista con apiKeyMasked vía maskSecret — nunca la clave —, POST crea cifrando apiKey con encryptSecret; si isDefault=true desmarca los demás); ai/providers/[id]/route.ts (PATCH: apiKey solo se reemplaza si viene no vacía; DELETE); ai/providers/[id]/test/route.ts (POST → testProvider de src/lib/ai/test-connection.ts con la clave descifrada). Cada escritura registra AdminAuditLog (src/lib/audit.ts).
2. Pública sin auth: src/app/api/legal/[slug]/route.ts → GET { title, content, version, updatedAt } o 404.
3. src/app/api/creations/[type]/route.ts: el límite de creaciones por usuario debe leer limits.creationsPer10Min de AppSetting (caché 60 s, default 20) en lugar del 20 fijo (`grep -n "20" src/app/api/creations/\[type\]/route.ts`).
4. Tests Vitest: providers (403 para user; POST guarda apiKeyEnc ≠ apiKey; GET devuelve solo máscara; isDefault exclusivo); legal público (200 y 404); límite leído de AppSetting.
5. npx tsc --noEmit ; npm run lint ; npm test ; npm run build.
6. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-3): rutas de IA, legal público y límite configurable" && git push origin main.
