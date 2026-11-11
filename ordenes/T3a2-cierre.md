# ORDEN T3a2 — Cierre de T3a (perfil: autenticaci-n-y-gesti-n-de-usuarios). Sé breve; informe máx. 8 líneas.
Tu ejecución anterior de T3a escribió src/auth.ts, rutas api/auth, middleware, session, rate-limit, api-errors, contracts/auth.ts y tests. Claude verificó: tsc OK, lint OK, 39 tests OK; FALLA tests/api/register.test.ts porque Vitest no carga .env (DATABASE_URL undefined → PrismaClientKnownRequestError en deleteMany).
Haz SOLO esto:
1. vitest.config.ts: añade test.setupFiles: ['dotenv/config'] (dotenv ya está instalado; si no, npm i -D dotenv).
2. Docker y BD ya están levantados. Corre npm test: los 42 tests deben pasar (incluidos los 3 de register). Si alguno falla, corrígelo.
3. npx tsc --noEmit, npm run lint, npm run build.
4. git add -A (verifica que .env no aparezca) && git commit -m "feat(T3a): Auth.js credenciales, registro, middleware y sesión" && git push origin main.
