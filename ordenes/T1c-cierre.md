# ORDEN T1c — Cierre de T1 (perfil: devops-y-despliegue)
Sé conciso: usa herramientas, informe final máx. 25 líneas. Directorio: /Users/omar/Desktop/Claude/cafe-santo-domingo.
Claude ya revisó: .gitignore, docker-compose.yml, prisma.config.ts, schema, migración init, src/lib/db.ts, scripts de package.json, .env.example, vitest.config.ts, playwright.config.ts y tests/smoke.test.ts EXISTEN. No los rehagas. La Mac se reinició: Docker está encendido pero el contenedor puede estar parado.

FALTA:
1. npm run db:up y npx prisma migrate status (debe estar al día; si no, npx prisma migrate deploy).
2. Añade `/src/generated/` al .gitignore (el cliente Prisma se genera en postinstall; no se versiona). Confirma que build sigue funcionando.
3. README.md: reemplaza el texto de create-next-app por pasos reales en español (requisitos Node 20+, Docker; npm i; cp .env.example .env y rellenar AUTH_SECRET con openssl rand -base64 32; npm run db:up; npm run db:migrate; npm run dev; npm test).
4. src/app/page.tsx: placeholder simple (fondo oscuro, texto "Café Santo Domingo" y "De ideas a contenido"), sin next/image. Borra de public/ los svg de ejemplo (file, globe, next, vercel, window).
5. Verifica y reporta salidas reales: npm run lint, npx tsc --noEmit, npm test, npm run build.
6. git status: confirma que .env y src/generated NO aparecen. git add -A, commit "feat(T1): scaffolding Next.js, Prisma, Docker, tooling", git push origin main.
