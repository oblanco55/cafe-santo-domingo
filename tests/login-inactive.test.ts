import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

/**
 * Tests Fase 2 — cuenta desactivada y promoto a admin.
 *
 * La lógica relevante vive en el provider de credenciales de src/auth.ts,
 * cuya función `authorize` ejecuta: (1) lookup por email, (2) check
 * `active === false` → null, (3) auto-promoción si email ∈ ADMIN_EMAILS.
 *
 * NextAuth v5 (lib/env.js) importa `next/server`, que solo resuelve en el
 * runtime de Next.js (app router). No es importable en vitest sin un alias
 * específico. Para cubrir el flujo sin arrastrar Node ESM de Next:
 *
 * - Replicamos la decisión de authorization localmente (mismo criterio:
 *   `active === false` → null; email en ADMIN_EMAILS && role!=='admin' →
 *   role='admin').
 * - Validamos contra la BD real (estado persistido).
 *
 * IMPORTANTE: vitest necesita la BD docker (npm run db:up).
 */

const INACTIVE_EMAIL = 'f2-inactive@example.com';
const ACTIVE_EMAIL = 'f2-active@example.com';
const TEST_NAME = 'Usuario F2';
const TEST_PASSWORD = 'MiClave1';

async function createUser(email: string, role: 'user' | 'admin', active: boolean) {
  await db.user.deleteMany({ where: { email } });
  const hash = await bcrypt.hash(TEST_PASSWORD, 12);
  await db.user.create({
    data: {
      name: TEST_NAME,
      email,
      passwordHash: hash,
      termsAcceptedAt: new Date(),
      role,
      active,
    },
  });
}

/**
 * Lógica local que refleja el criterio de `authorize` en src/auth.ts:
 *   - user null                       → null
 *   - active === false                → null
 *   - passwordHash mismatch           → null
 *   - email en ADMIN_EMAILS y role != 'admin' → 'admin'
 *   - else                             → 'user'
 */
async function authorizer(
  email: string,
  password: string,
): Promise<null | { role: 'user' | 'admin' }> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;
  if (user.active === false) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  let role = user.role;
  if (
    role !== 'admin' &&
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes(email.toLowerCase())
  ) {
    role = 'admin';
    await db.user.update({ where: { id: user.id }, data: { role: 'admin' } });
  }
  return { role };
}

beforeAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [INACTIVE_EMAIL, ACTIVE_EMAIL] } },
  });
});

afterAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [INACTIVE_EMAIL, ACTIVE_EMAIL] } },
  });
  delete process.env.ADMIN_EMAILS;
});

describe('login — cuentas desactivadas y promoto a admin (criterio de authorize)', () => {
  it('usuario con active=false → authorize() devuelve null (login rechazado)', async () => {
    await createUser(INACTIVE_EMAIL, 'user', false);

    expect(await authorizer(INACTIVE_EMAIL, TEST_PASSWORD)).toBeNull();
  });

  it('usuario con active=true → authorize() devuelve { role: "user" }', async () => {
    await createUser(ACTIVE_EMAIL, 'user', true);

    const result = await authorizer(ACTIVE_EMAIL, TEST_PASSWORD);
    expect(result).toEqual({ role: 'user' });
  });

  it('usuario activo en ADMIN_EMAILS con role="user" → se promueve a admin', async () => {
    process.env.ADMIN_EMAILS = ACTIVE_EMAIL;
    await createUser(ACTIVE_EMAIL, 'user', true);

    const result = await authorizer(ACTIVE_EMAIL, TEST_PASSWORD);
    expect(result).toEqual({ role: 'admin' });

    const stored = await db.user.findUnique({ where: { email: ACTIVE_EMAIL } });
    expect(stored?.role).toBe('admin');

    delete process.env.ADMIN_EMAILS;
  });

  it('contraseña incorrecta → authorize() devuelve null', async () => {
    await createUser(ACTIVE_EMAIL, 'user', true);
    expect(await authorizer(ACTIVE_EMAIL, 'otra-clave')).toBeNull();
  });
});
