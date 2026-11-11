# ORDEN T3c — Rol de administrador (perfil: autenticaci-n-y-gesti-n-de-usuarios)
REGLAS: breve, un archivo por llamada; no toques src/lib/ai ni UI salvo lo indicado. Si un paso falla 2 veces, DETENTE y reporta.
1. prisma/schema.prisma: enum Role { user admin }; en User añade `role Role @default(user)`. npx prisma migrate dev --name add_user_role (BD docker en 5433).
2. src/auth.ts: incluye role en el JWT y en session.user (callbacks jwt/session) y en src/types/next-auth.d.ts.
3. src/lib/session.ts: añade requireAdmin() → si session.user.role !== 'admin' lanza ApiError 403 FORBIDDEN "No tienes permisos para esta acción." (añade 'FORBIDDEN' al union de códigos en src/lib/contracts/api.ts).
4. El registro público SIEMPRE crea role 'user' (no aceptar role desde el body). Test Vitest: registrar enviando role:'admin' en el body → en BD queda 'user'. Test de requireAdmin (user → 403, admin → ok).
5. npx tsc --noEmit ; npm run lint ; npm test ; npm run build.
6. git add -A (sin .env) && git commit -m "feat(T3c): rol de usuario (user/admin) en sesión" && git push origin main. Informe máx. 8 líneas.
