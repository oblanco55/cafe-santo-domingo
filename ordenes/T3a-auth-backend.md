# ORDEN T3a — Auth backend (perfil: autenticaci-n-y-gesti-n-de-usuarios)
Contexto completo: ordenes/T3-auth.md. Esta orden cubre SOLO sus puntos 1–6 y los tests Vitest del punto 8 (no páginas, no Playwright).
Notas técnicas verificadas por Claude: zod v4; Prisma 7 con cliente generado en src/generated/prisma (importa PrismaClient desde '@/generated/prisma/client' o como lo haga src/lib/db.ts — reutiliza src/lib/db.ts); next-auth v5 beta instalado; contratos en src/lib/contracts (reexportados en index.ts) — añade auth.ts ahí y reexpórtalo. La BD docker corre en localhost:5433 (npm run db:up si no).
Sé breve; un archivo por llamada. Verifica: npx tsc --noEmit, npm run lint, npm test, npm run build.
Commit "feat(T3a): Auth.js credenciales, registro, middleware y sesión" + git push origin main. Informe máx. 12 líneas con salidas reales.
