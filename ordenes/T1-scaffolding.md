# ORDEN T1 — Scaffolding (perfil: devops-y-despliegue)
Ordena: Claude (cerebro). Ejecuta: Hermes. Lee primero PLAN.md e IDEA.md en la raíz.

Directorio de trabajo: /Users/omar/Desktop/Claude/cafe-santo-domingo (repo git ya inicializado, remoto origin = github oblanco55/cafe-santo-domingo, rama main). NO borres ni muevas IDEA.md, PLAN.md, los .docx/.pdf, las imágenes ni la carpeta ordenes/.

Construye en la RAÍZ del repo (no en subcarpeta):
1. Proyecto Next.js 15 (App Router, carpeta src/, TypeScript strict, ESLint, Tailwind CSS, alias @/*). Gestor: npm. Si create-next-app no admite directorio no vacío, créalo en carpeta temporal y mueve los archivos a la raíz sin pisar los existentes.
2. docker-compose.yml con PostgreSQL 16 (servicio "db", puerto host 5433, volumen nombrado, usuario/clave/BD "cafesantodomingo" solo para desarrollo local).
3. Prisma: dependencia prisma + @prisma/client; prisma/schema.prisma con los modelos exactos de PLAN.md §2 "Modelo de datos":
   - User: id cuid, name, email @unique, passwordHash, termsAcceptedAt DateTime, createdAt, relación 1-1 opcional BusinessProfile, 1-n Creation.
   - BusinessProfile: id, userId @unique, countryIso String?, offerType enum OfferType(product,service)?, sector String?, sectorOther String?, description String?, updatedAt.
   - Creation: id, userId, type enum CreationType(video,photo,carousel), input Json, output Json?, status enum CreationStatus(ok,error), errorMessage String?, model String?, createdAt; índice (userId, createdAt).
   Crea la migración inicial (prisma migrate dev --name init) con la BD de docker levantada.
4. src/lib/db.ts con singleton de PrismaClient.
5. .env.example con (sin valores secretos): DATABASE_URL (ejemplo local), AUTH_SECRET=, ANTHROPIC_API_KEY=, AI_PROVIDER=mock, AI_MODEL=claude-sonnet-5-5. Crea también .env local copiando .env.example con DATABASE_URL local y AUTH_SECRET aleatorio (openssl rand -base64 32). .env NO se sube a git (ya está en .gitignore; no lo modifiques para incluirlo).
6. Dependencias para fases siguientes (solo instalar): zod, next-auth@beta, bcryptjs, @anthropic-ai/sdk; dev: vitest, @vitejs/plugin-react, @playwright/test, @types/bcryptjs. Config mínima vitest.config.ts y playwright.config.ts (baseURL http://localhost:3000, proyectos chromium escritorio y móvil "Pixel 7").
7. Scripts package.json: dev, build, start, lint, test (vitest run), test:e2e (playwright test), db:up (docker compose up -d db), db:migrate (prisma migrate dev).
8. README.md breve: requisitos, pasos para arrancar (npm i, cp .env.example .env, npm run db:up, npm run db:migrate, npm run dev).
9. Página src/app/page.tsx: un placeholder simple "Café Santo Domingo" (la UI real es T6). No construyas auth, IA ni formularios: están fuera de T1.

Verificación OBLIGATORIA antes de terminar (ejecuta y reporta salidas reales, no inventes):
- npm run lint
- npm run build
- npx prisma migrate status
- un test vitest trivial (tests/smoke.test.ts) con npm test
Commit en main con mensaje "feat(T1): scaffolding Next.js, Prisma, Docker, tooling" y git push origin main.

Informe final: lista de archivos creados, versiones instaladas, salida resumida de cada verificación, y cualquier problema. Si algo falla y no puedes arreglarlo, NO lo ocultes: repórtalo.
