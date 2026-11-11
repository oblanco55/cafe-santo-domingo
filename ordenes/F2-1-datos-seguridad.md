# ORDEN F2-1 — Datos y seguridad de la Fase 2 (perfil: desarrollador-backend)
LEE PLAN-F2.md (secciones "Seguridad de secretos", "Cuenta administradora" y "Modelo de datos"). Breve; un archivo por llamada; informe máx. 10 líneas. Si un paso falla 2 veces, DETENTE.
HECHOS VERIFICADOS: Prisma 7 con prisma/schema.prisma y prisma.config.ts; cliente en src/generated/prisma; src/lib/db.ts exporta `db`; src/auth.ts (Credentials + callbacks jwt/session con role); registro en src/app/api/auth/register/route.ts; enum Role {user admin} ya existe; BD docker en localhost:5433.
1. schema.prisma (migración aditiva `npx prisma migrate dev --name fase2_admin`):
   - User: `active Boolean @default(true)`.
   - Creation: `hiddenAt DateTime?`, `parentId String?` (relación opcional a Creation "variants").
   - enum AIProviderKind { anthropic openai_compatible }.
   - model AIProvider { id cuid, label String, kind AIProviderKind, baseUrl String?, model String, apiKeyEnc String?, enabled Boolean @default(true), isDefault Boolean @default(false), priority Int @default(100), createdAt, updatedAt }.
   - model AppSetting { key String @id, value Json, updatedAt DateTime @updatedAt, updatedBy String? }.
   - model LegalDocument { slug String @id, title String, content String, version Int @default(1), updatedAt DateTime @updatedAt, updatedBy String? }.
   - model AdminAuditLog { id cuid, adminId String, action String, target String?, detail Json?, createdAt DateTime @default(now()) ; @@index([createdAt]) }.
2. src/lib/crypto.ts: encryptSecret(plain) / decryptSecret(enc) con AES-256-GCM (node:crypto), clave de `SETTINGS_ENCRYPTION_KEY` (base64, 32 bytes; si falta → Error claro "Falta SETTINGS_ENCRYPTION_KEY"); formato "v1:<iv b64>:<tag b64>:<data b64>"; maskSecret(plain) → "••••" + últimos 4. Añade SETTINGS_ENCRYPTION_KEY y ADMIN_EMAILS a .env.example (sin valores) y genera valores locales en .env (openssl rand -base64 32; ADMIN_EMAILS vacío).
3. src/lib/admin-emails.ts: isAdminEmail(email) leyendo ADMIN_EMAILS (coma-separado, trim, minúsculas). En el registro: role = isAdminEmail ? 'admin' : 'user'. En authorize de src/auth.ts: si el usuario existe y isAdminEmail y role≠admin → actualizar a admin; si `active=false` → rechazar el login (devolver null).
4. Semilla idempotente prisma/seed.ts (con el mecanismo de seed de Prisma 7 en prisma.config.ts): upsert de LegalDocument 'terminos' y 'privacidad' con el texto provisional actual de src/app/terminos y src/app/privacidad (en Markdown). Ejecútala en local.
5. Tests Vitest: crypto (ida y vuelta, clave errónea falla, mask), isAdminEmail, registro con correo en ADMIN_EMAILS → admin, login de usuario inactivo → rechazado.
6. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
7. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-1): modelo de datos fase 2, cifrado de secretos y ADMIN_EMAILS" && git push origin main.
