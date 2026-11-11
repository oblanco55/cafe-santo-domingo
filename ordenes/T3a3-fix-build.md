# ORDEN T3a3 — Arreglar build de auth (perfil: autenticaci-n-y-gesti-n-de-usuarios)
REGLAS: sé breve. NO refactorices nada fuera de esta lista. Si un paso falla 2 veces, DETENTE y reporta el error exacto (no explores alternativas).
Claude restauró src/lib/db.ts y next.config.ts a la versión de T1 (export const db, import estático) y borró next.config.mjs y src/middleware-auth.ts. NO los vuelvas a crear.
Causa del fallo de build: src/middleware.ts importa src/auth.ts (Prisma) y el middleware corre en Edge. Solución elegida por Claude: middleware en runtime Node (estable en Next 15.5).
Pasos exactos:
1. src/middleware.ts: en el objeto `export const config` añade `runtime: 'nodejs'` (conserva el matcher).
2. src/auth.ts: cambia `import { getDb } from '@/lib/db'` por `import { db } from '@/lib/db'` y elimina `const db = await getDb();` (y el comentario de la línea 13 sobre getDb).
3. src/app/api/auth/register/route.ts: igual que el paso 2.
4. Corre: npx tsc --noEmit ; npm run lint ; npm test (deben pasar 42, BD docker ya levantada) ; npm run build.
5. Si todo pasa: git add -A (comprueba que .env no aparece) && git commit -m "feat(T3a): Auth.js credenciales, registro, middleware y sesión" && git push origin main.
Informe máx. 8 líneas con resultado real de cada comando.
