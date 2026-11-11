# Café Santo Domingo

De ideas a contenido. Plataforma web construida con Next.js, Prisma y PostgreSQL.

## Requisitos

- Node.js 20 o superior
- Docker (para la base de datos PostgreSQL)

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de entorno y rellenar AUTH_SECRET
cp .env.example .env
# Genera un secreto para AUTH_SECRET:
openssl rand -base64 32
# Pega el valor en .env -> AUTH_SECRET=...

# 3. Arrancar PostgreSQL (Docker)
npm run db:up

# 4. Aplicar migraciones de base de datos
npm run db:migrate

# 5. Servidor de desarrollo
npm run dev
# Abre http://localhost:3000

# 6. Pruebas
npm test
```

## Scripts de npm

| Script            | Descripción                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Servidor de desarrollo               |
| `npm run build`   | Compilación de producción            |
| `npm start`       | Servidor de producción               |
| `npm run lint`    | ESLint                               |
| `npm test`        | Pruebas de unidad (Vitest)           |
| `npm run test:e2e`| Pruebas E2E (Playwright)             |
| `npm run db:up`   | Arranca PostgreSQL con Docker        |
| `npm run db:down` | Detiene los contenedores de Docker   |
| `npm run db:migrate` | Migraciones de desarrollo (Prisma)|
| `npm run db:deploy`| Migraciones de producción (Prisma) |

## Variables de entorno

Ver `.env.example`: `DATABASE_URL` y `AUTH_SECRET` (obligatorio; `AUTH_SECRET` debe ser un valor aleatorio, p. ej. generado con `openssl rand -base64 32`).

El cliente Prisma se genera automáticamente en `postinstall` (`prisma generate`) y **no se versiona** (`/src/generated/` está en `.gitignore`).
