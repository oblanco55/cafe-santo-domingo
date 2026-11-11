# Café Santo Domingo — Entrega (Fase 8)

Fecha: 2026-10-23 · Repositorio: `github.com/oblanco55/script28` (privado, rama `main`) · Producción: https://web-production-38743.up.railway.app
Roles: **Claude** (auditoría, arquitectura, órdenes, verificación) · **Hermes** (`qwen3.8:27b` en la ZimaBoard, escribió el código). Todas las órdenes e informes están en `ordenes/`.

## 1. Arquitectura

No existía código previo (tampoco el módulo de video que mencionaba IDEA.md). Se construyó desde cero:

| Capa | Tecnología |
|---|---|
| App (UI + API) | Next.js 15.5 (App Router), TypeScript estricto, React 19 |
| Estilos | Tailwind CSS v4 con tokens de `docs/DISENO.md` (paleta oficial, Plus Jakarta Sans, logo oficial) |
| Base de datos | PostgreSQL 16 (Docker en local, Railway en producción) + Prisma 7 (`@prisma/adapter-pg`) |
| Autenticación | Auth.js v5 (credenciales + bcrypt coste 12, sesión JWT en cookie httpOnly/secure), middleware en runtime Node |
| IA | `@anthropic-ai/sdk` con salida estructurada (tool use) + proveedor `mock`; validación zod v4 y 1 reintento |
| Contratos | `src/lib/contracts` (catálogos, entradas, salidas, API) compartidos por UI, API e IA |
| Pruebas | Vitest (unitarias/API) + Playwright (E2E escritorio y móvil Pixel 7) |
| Despliegue | Railway: servicio `web` (GitHub `main`, deploy automático) + `Postgres` |

Flujo: Inicio → Registro/Login → Panel «¿Qué deseas crear hoy?» → Video | Fotografía | Carrusel → Formulario contextual → Validación → IA → Resultado → Copiar guía / Copiar copy / Editar / Crear otro.

## 2. Funcionalidades implementadas

- Registro (nombre, correo único, contraseña, aceptación de términos) e inicio/cierre de sesión; la sesión se conserva entre modalidades.
- Rol `user`/`admin` en la sesión (`requireAdmin()`); el registro público siempre crea `user`.
- Panel con las 3 modalidades (iconos y textos oficiales).
- Formularios contextuales: 8 campos comunes (país, producto/servicio, sector con «otro», descripción con etiqueta dinámica, plataforma, objetivo, equipo, recursos) + específicos: video 15/30/45 s; foto 1:1 o 9:16 + tipo de foto; carrusel 3/5/7 láminas + estructura + formato. Botón deshabilitado hasta que el esquema valide.
- Precarga del perfil del negocio en la siguiente creación.
- Motor de IA con prompt de sistema **separado por modalidad**: datos del usuario como contenido no confiable, prohibición de inventar precios/beneficios/certificaciones/resultados, adaptación a país/sector/plataforma, alternativas con celular y recursos sencillos, reglas del sector legal y producto vs. servicio.
- Foto: una sola toma con 8 secciones + copy. Carrusel: exactamente N láminas con función narrativa, encuadre, ángulo, luz, fondo, utilería y texto sobre imagen, más estilo común. Video: escenas que cubren exactamente la duración.
- Resultado en bloques numerados, copy en bloque separado, «Copiar guía» y «Copiar copy» independientes, «Editar respuestas», «Crear otro»; error con «Reintentar» sin perder respuestas.
- Persistencia de cada solicitud (modalidad, entrada, salida, estado, modelo, fecha) para auditoría, incluidos los fallos de IA.
- Límite de uso: 10 intentos/10 min por IP en registro/login; 20 creaciones/10 min por usuario.

## 3. Archivos principales

| Área | Archivos |
|---|---|
| Contratos | `src/lib/contracts/{catalogs,inputs,outputs,api,auth,index}.ts` |
| Auth | `src/auth.ts`, `src/middleware.ts`, `src/lib/session.ts`, `src/lib/rate-limit.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/**` |
| IA | `src/lib/ai/{provider,anthropic,mock,index,errors,engine}.ts`, `src/lib/ai/prompts/{common,photo,carousel,video}.ts` |
| API | `src/app/api/creations/[type]/route.ts`, `src/app/api/creations/item/[id]/route.ts`, `src/app/api/profile/route.ts` |
| UI | `src/app/{page,registro,login,panel,terminos,privacidad,crear/[type]}/…`, `src/components/ui/*`, `src/components/creation/{CreationForm,CreationScreen,ResultView,format}.*` |
| Marca | `public/brand/*`, `src/app/icon.png`, `src/app/apple-icon.png` |
| BD | `prisma/schema.prisma`, `prisma/migrations/*`, `prisma.config.ts`, `src/lib/db.ts` |
| Pruebas | `tests/**` (13 archivos Vitest), `tests/e2e/*.spec.ts` (6 specs) |
| Docs | `PLAN.md`, `docs/DISENO.md`, `docs/ENTREGA.md`, `README.md`, `ordenes/*` |

## 4. Base de datos

Migraciones (aplicadas en local y en Railway con `prisma migrate deploy` antes de cada deploy):
1. `20261022215706_init` — `User`, `BusinessProfile` (1-1), `Creation` (índice `userId, createdAt`); enums `OfferType`, `CreationType`, `CreationStatus`.
2. `20261023011742_add_user_role` — enum `Role {user, admin}` y `User.role @default(user)`.

No hubo cambios destructivos.

## 5. Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | — | Crea usuario. 201 · 400 validación · 409 correo existente · 429 límite |
| GET/POST | `/api/auth/*` | — | Auth.js (csrf, callback/credentials, session, signout) |
| POST | `/api/creations/{video\|photo\|carousel}` | sesión | Genera y guarda. 201 `{id,type,output}` · 400 · 401 · 404 modalidad · 429 · 502 IA |
| GET | `/api/creations/item/{id}` | sesión | Devuelve una creación propia (404 si es de otro usuario) |
| GET/PUT | `/api/profile` | sesión | Lee / actualiza el perfil del negocio |

Páginas: `/`, `/registro`, `/login`, `/panel`, `/crear/video`, `/crear/foto`, `/crear/carrusel`, `/terminos`, `/privacidad` (`/panel` y `/crear/*` protegidas).

## 6. Integraciones de IA

- `AI_PROVIDER=anthropic`: Claude vía Messages API, modelo `AI_MODEL` (por defecto `claude-sonnet-5-5`), herramienta forzada `entregar_resultado` cuyo `input_schema` es el JSON Schema del contrato zod; timeout 60 s.
- `AI_PROVIDER=mock`: salidas deterministas y válidas (uso actual en producción y en pruebas).
- Validación de salida + 1 reintento con los errores; si falla → `AI_FAILED` (502) y registro con `status=error`.
- Fuera de alcance (respetado): no se generan ni editan imágenes.

## 7. Pruebas ejecutadas (resultados reales, 2026-10-23, ejecutadas por Claude)

| Suite | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npm run lint` | 0 errores, 5 avisos (variables no usadas en tests) |
| `npm test` (Vitest) | **111/111** en 13 archivos |
| `npm run build` | Compila |
| `npm run test:e2e` (Playwright, escritorio + móvil) | **42/42** |
| Humo en producción (Railway) | registro 201, login 302, `/crear/{video,foto,carrusel}` 200, carrusel 7 láminas 9:16 → 7 láminas, carrusel 4 → 400, perfil precargado |
| Revisión visual (navegador, 390 px) | landing, registro, panel y resultado de carrusel (5 láminas) correctos |

Cobertura E2E (Fase 7): registro/login/sesión persistente, foto 1:1 producto y 9:16 servicio, carrusel 3/5/7, video 15/30/45, copiar guía y copy por separado, error 502 + reintento sin perder respuestas, «Crear otro», precarga, sesión entre modalidades, 401 sin sesión, registro con `role:'admin'` → sesión `user`, validación de servidor (4 láminas → 400), `/crear/xyz` → 404.

Errores reales detectados durante la verificación y corregidos: modalidad equivocada en `/crear/foto` y `/crear/carrusel`; build roto por tipos de salida; etiqueta «Vertical Story 1:1»; límite de intentos que confiaba en la IP falsificable de `x-forwarded-for`.

## 8. Incidencias pendientes

1. **Generación real con IA no probada**: falta `ANTHROPIC_API_KEY`; producción usa `mock`. Al configurarla hay que revisar la calidad de las guías reales (adaptación a plataforma, no inventar datos).
2. **Textos legales provisionales** en `/terminos` y `/privacidad` (marcados como pendientes).
3. **Cuenta admin** de `resp5totech@gmail.com`: requiere que el usuario se registre y que se ejecute el `UPDATE` de rol en Railway (ver §10).
4. El rol `admin` aún no habilita funciones (no hay panel de administración; definir alcance).
5. El límite de uso es en memoria: se reinicia con cada deploy y no se comparte entre réplicas.
6. Política de retención de `Creation` sin definir (spec Carrusel §9).
7. Cuentas de prueba creadas por Claude en producción (`prod.check…`, `prod.t9…@example.com`): se pueden borrar con autorización.
8. Infra de Hermes (no afecta a la app): la ZimaBoard tiene 15 GB de RAM; con `wan-video` encendido Ollama muere por falta de memoria.

## 9. Variables de entorno (sin valores)

| Variable | Uso | Producción |
|---|---|---|
| `DATABASE_URL` | Conexión PostgreSQL | `${{Postgres.DATABASE_URL}}` |
| `AUTH_SECRET` | Firma de la sesión | configurada (generada aleatoriamente) |
| `AUTH_URL` | URL pública para Auth.js | configurada |
| `PORT` | Puerto del servidor | 8080 |
| `AI_PROVIDER` | `mock` \| `anthropic` | `mock` |
| `AI_MODEL` | Modelo de Claude | `claude-sonnet-5-5` |
| `ANTHROPIC_API_KEY` | Clave de Anthropic | **pendiente** |

## 10. Ejecutar y desplegar

Local:
```bash
npm i
cp .env.example .env   # rellenar AUTH_SECRET con: openssl rand -base64 32
npm run db:up
npm run db:migrate
npm run dev            # http://localhost:3000
npm test && npm run test:e2e
```

Producción (Railway, proyecto `script28`): cada push a `main` construye (`npm run build`), ejecuta `npx prisma migrate deploy` y arranca (`npm start`); healthcheck `/login`.

Activar la IA real: en Railway → servicio `web` → Variables: `ANTHROPIC_API_KEY=<clave>` y `AI_PROVIDER=anthropic`.

Ascender la cuenta admin (Railway → Postgres → Data → Query), después de registrarse:
```sql
UPDATE "User" SET role = 'admin' WHERE email = 'resp5totech@gmail.com';
```

## 11. Reversión

- **Código**: Railway → servicio `web` → Deployments → «Rollback» al deploy anterior; o `git revert <commit>` y push a `main` (deploy automático).
- **IA**: volver a `AI_PROVIDER=mock` desactiva la IA real sin redeploy de código.
- **Base de datos**: las dos migraciones son aditivas. Revertir el rol: `ALTER TABLE "User" DROP COLUMN "role"; DROP TYPE "Role";` y borrar su fila de `_prisma_migrations` (solo con respaldo previo).
- **Configuración de Hermes/ZimaBoard**: respaldos en `~/.hermes/profiles/*/config.yaml.bak-*` y `/var/lib/casaos/apps/ollama-nvidia/docker-compose.yml.bak-script28`.
