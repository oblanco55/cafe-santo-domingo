# ORDEN T1b — Continuación de T1 (perfil: devops-y-despliegue)
Tu ejecución anterior de T1 se cortó por límite de tokens. Sé conciso: actúa con herramientas, no escribas explicaciones largas.
Lee ordenes/T1-scaffolding.md (la orden completa). Directorio: /Users/omar/Desktop/Claude/Script 28.

YA HECHO (no repetir): Next.js 15 en la raíz con src/, Tailwind, ESLint; dependencias instaladas (prisma 7, @prisma/client 7, zod 4, next-auth beta, bcryptjs, @anthropic-ai/sdk, vitest, playwright). Docker ya está encendido.

FALTA (hazlo en este orden):
1. .gitignore: hoy contiene `.env*`, lo que ignora también .env.example. Cámbialo a `.env` y `.env*.local` y añade `!.env.example`. Conserva el resto.
2. docker-compose.yml (punto 2 de T1) y levántalo: docker compose up -d db.
3. Prisma 7 (ojo: v7 usa prisma.config.ts y el generator "prisma-client" con output; sigue la convención oficial de v7 y verifica con la doc/CLI instalada): schema con los modelos de T1 punto 3, migración init aplicada, src/lib/db.ts singleton (adaptador @prisma/adapter-pg si v7 lo requiere). Añade "postinstall": "prisma generate" en scripts.
4. .env.example y .env (punto 5).
5. vitest.config.ts, playwright.config.ts, tests/smoke.test.ts (punto 6).
6. Scripts db:up, db:migrate, y "db:deploy": "prisma migrate deploy" (lo usará Railway).
7. README.md: reemplaza el texto de create-next-app por los pasos reales en español (punto 8).
8. src/app/page.tsx placeholder "SCRIPT 28" y borra los svg de ejemplo de public/ que no se usen.

Verifica y pega salidas reales resumidas: npm run lint, npx tsc --noEmit, npm test, npm run build, npx prisma migrate status.
Luego: git add -A (comprueba antes con git status que .env NO aparece), commit "feat(T1): scaffolding Next.js, Prisma, Docker, tooling" y git push origin main.
Informe final breve (máx. 30 líneas). Si algo falla, dilo.
