# Fase 2 — Entrega F2-1 (datos y seguridad)

> Orden: `ordenes/F2-1-datos-seguridad.md`
> Fecha: 2026-10-23
> Autor: desarrollador-backend (profile desarrollado-backend)

## Escopo

Extensión del modelo de datos (additive), cifrado de secretos con
AES-256-GCM, cuentas de administración vía `ADMIN_EMAILS` y actualización
del flujo de auth.

Sin cambios a `src/app/api/creations/**` (T10 / F2-1) — la lógica de
creaciones de la Fase 1 sigue intacta.

## 1. Modelo de datos (prisma/schema.prisma)

### Enums nuevos

| Enum                 | Valores                                  | Uso                                |
| -------------------- | ---------------------------------------- | ---------------------------------- |
| `AIProviderKind`     | `anthropic`, `openai_compatible`         | Discriminación del tipo de provider|

`Role { user admin }` y `CreationStatus { pending processing ready failed }`
se conservan sin cambio. `user` sigue siendo el valor por defecto (el
criterio de "admin por defecto" se documenta en las notas de la orden, no en
el enum).

### User (campos nuevos)

```prisma
active   Boolean @default(true)   // nueva; cuentas desactivadas no loguean
role     Role    @default(user)   // (ya existía)
// ... campos anteriores se conservan (id, name, email, passwordHash, termsAcceptedAt, timestamps)
```

### Creation (campos nuevos)

```prisma
hiddenAt           DateTime?            // nueva; ocultamiento admin
parentId           String?              // nueva; link a variaciones
parent             Creation?   @relation("variants", fields: [parentId], references: [id])
variants           Creation[]           @relation("variants")
@@index([parentId])
```

El índice sobre `parentId` permite consultas rápidas de variaciones sin
cruzar todos los registros.

### Modelos nuevos

```prisma
model AIProvider {
  id          String   @id @default(cuid())
  label       String
  kind        AIProviderKind
  baseUrl     String?
  model       String
  apiKeyEnc   String?   // AES-256-GCM (v1:<iv>:<tag>:<data>)
  enabled     Boolean  @default(true)
  isDefault   Boolean  @default(false)
  priority    Int      @default(10)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([priority])
}

model AppSetting {
  key        String   @id
  value      Json
  updatedAt  DateTime @updatedAt
  updatedBy  String?
}

model LegalDocument {
  slug       String   @id           // 'terminos' | 'privacidad'
  title      String
  content    String
  version    Int      @default(1)
  updatedAt  DateTime @updatedAt
  updatedBy  String?
}

model AdminAuditLog {
  id          String   @id @default(cuid())
  actorId     String?
  actorEmail  String?
  action      String
  target      String?
  payload     Json?
  createdAt   DateTime @default(now())
  @@index([target])
  @@index([actorEmail])
}
```

## 2. Cifrado de secretos (src/lib/crypto.ts)

- **Algoritmo**: AES-256-GCM.
- **Configuración**:
  - `IV_LENGTH = 12` bytes (random)
  - `TAG_LENGTH = 16` bytes
  - `KEY_LENGTH = 32` bytes (derivada de `SETT…KEY`)
- **Formato de salida**: `v1:<iv b64>:<tag b64>:<data b64>` (versionado para
  permitir rotación sin romper secretos existentes).
- **Funciones**:
  - `encryptSecret(plain) → string`
  - `decryptSecret(ciphertext) → string`
  - `maskSecret(plain) → "••••" + últimos 4` (para UI sin exponer el secreto)
- **Comportamiento**:
  - `encryptSecret` falla con Error si falta la clave o su tamaño/codec es
    inválido.
  - `decryptSecret` **resuelve la clave antes de parsear el formato**: si
    falta, se falla con `Falta SETTINGS_ENCRYPTION_KEY` (no se expone el
    formato inválido). Con clave distinta, el tag GCM falla → error de
    autenticación (sin texto falso).
  - `maskSecret('')` → `"••••"`, `maskSecret('abcd')` → `"••••abcd"`,
    `maskSecret('secret1234')` → `"••••1234"`.
- **La clave NUNCA se persiste, ni se registra en logs.**

## 3. Cuentas administradoras (ADMIN_EMAILS)

- Fuente: `src/lib/admin-emails.ts`
  - `isAdminEmail(email)` — case-insensitive, trim, split por comas.
  - `resolveRegisterRole(email)` — `'admin'` si está en la lista, `'user'`
    si no.
- **Registro** (`src/app/api/auth/register/route.ts`):
  - El campo `role` recibido del cliente se **ignora**; el servidor decide
    según `ADMIN_EMAILS`. Un `role: 'admin'` enviado no es aceptado.
  - El registro crea el usuario con `active: true` (por defecto en schema).
- **Autorización** (`src/auth.ts`):
  - El provider de credenciales ahora devuelve `null` si `user.active
    === false` (cuentas desactivadas no loguean).
  - Si el email del usuario es `admin` según `ADMIN_EMAILS` pero en BD queda
    `role: 'user'`, se promueve a `admin` **idempotentemente**: al login se
    actualiza `user.role` en BD y se devuelve el objeto con `role: 'admin'`.
- **Desactivación**: un admin puede marcar `active = false` en el registro
  del usuario (punto previsto para el panel de la orden F2-3).

## 4. Semilla de legal content (prisma/seed.ts)

- **Idempotente**: solo crea si no existe; no sobrescribe.
- **Contenido**: texto provisional de `/terminos` y `/privacidad` (copiado
  de las páginas actuales).
- **Uso**:
  - `npx prisma db seed` o `npm run db:seed`.
  - En CI/CD, `prisma migrate deploy --seed=...` (según plataforma).
- **Resultado en BD** (verificado con psql):

  ```
  slug        | title                  | version | updatedBy
  ------------+------------------------+---------+-----------
  privacidad  | Política de privacidad | 1       | seed
  terminos    | Términos y condiciones | 1       | seed
  ```

## 5. Verificación

| Check                                  | Estado                          |
| -------------------------------------- | ------------------------------- |
| `npx tsc --noEmit`                     | ✓ OK (sin errores)              |
| `npm run lint`                         | ✓ OK (0 warnings)               |
| `npm test` (vitest)                    | ✓ 17 archivos / 133 tests green |
| `npm run build` (build de Next.js)     | ✓ OK                            |
| `npx prisma db seed` (2 veces)         | ✓ idempotente                   |
| `psql` → LegalDocument (2 filas)       | ✓ verificado                    |

### Tests nuevos de F2-1

1. `tests/crypto.test.ts` — 10 tests (encrypt/decrypt, clave errónea, clave
   ausente, tag corrupto, `maskSecret`).
2. `tests/admin-emails.test.ts` — 6 tests (`isAdminEmail`,
   `resolveRegisterRole`, case-insensitive, listas vacías).
3. `tests/register-admin-emails.test.ts` — 2 tests (registro con y sin
   email en `ADMIN_EMAILS`).
4. `tests/login-inactive.test.ts` — 4 tests (login activo, desactivado,
   promocion a admin, contraseña incorrecta).

Testes de Fase 1 / contrato ya existentes: **no modificados** (siguen
verdes tras los cambios).

## 6. Contratos API (no modificados)

Los endpoints de la Fase 1 **conservan el mismo contrato** (los tests de
contrato los validan y siguen pasando):

- `POST /api/auth/register`
- `GET|POST /api/creations/video`
- `GET /api/creations/item/[id]`
- `GET /api/profile`

La orden F2-1 no pide cambios a estas rutas; su alcance es el modelo de
datos, cifrado y admin.

## 7. Efectos sobre el sistema

- **BD**: migración `fase2_admin` (aplicada y versionada).
- **Env vars**: `SETTINGS_ENCRYPTION_KEY` nueva (base64 de 32 bytes);
  `ADMIN_EMAILS` opcional. Ambos reflejados en `.env.example`.
- **Auth**: el campo `active` se comprueba en cada login; `ADMIN_EMAILS`
  promueve idempotentemente al login.
- **Secrets**: ningún texto plano de secreto queda en BD ni en logs; la
  función de enmascaramiento (`maskSecret`) es lo único que se expone en
  la UI.

## 8. Limitaciones / siguientes pasos

- Los endpoints de **administración** (crear proveedor, activar/desactivar
  usuario, editar legal, exportar/borrar datos) **no** forman parte de F2-1;
  la orden los asigna a fases posteriores (F2-2 / F2-3).
- El panel de administración (UI) se construye sobre estos modelos cuando
  llegue F2-2.
