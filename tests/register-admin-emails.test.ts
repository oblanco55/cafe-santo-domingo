import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { POST } from '@/app/api/auth/register/route';

/**
 * Tests Fase 2 — ADMIN_EMAILS:
 *
 * A) Registro con correo en ADMIN_EMAILS → en BD queda role='admin'.
 * B) Registro con correo fuera de ADMIN_EMAILS → role='user' (base).
 *
 * IMPORTANTE: vitest necesita la BD docker (npm run db:up).
 * El handler es importado del registro público, lo que cubre el flujo
 * real end-to-end contra Prisma.
 */

const ADMIN_TEST_EMAIL = 'f2-admin-list@example.com';
const USER_TEST_EMAIL = 'f2-plain-user@example.com';
const TEST_NAME = 'Usuario F2';
const TEST_PASSWORD = 'MiClave1';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [ADMIN_TEST_EMAIL, USER_TEST_EMAIL] } } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [ADMIN_TEST_EMAIL, USER_TEST_EMAIL] } } });
  // Restaura estado de env (por si se usó)
  process.env.ADMIN_EMAILS = '';
});

describe('POST /api/auth/register + ADMIN_EMAILS', () => {
  it('correo en ADMIN_EMAILS → se crea con role=admin', async () => {
    process.env.ADMIN_EMAILS = `${ADMIN_TEST_EMAIL}, otro@example.com`;
    await db.user.deleteMany({ where: { email: ADMIN_TEST_EMAIL } });

    const res = await POST(
      makeRequest({
        name: TEST_NAME,
        email: ADMIN_TEST_EMAIL,
        password: TEST_PASSWORD,
        acceptTerms: true,
        role: 'user', // el valor enviado es ignorado; debe decidir el servidor
      }),
    );
    expect(res.status).toBe(201);

    const user = await db.user.findUnique({ where: { email: ADMIN_TEST_EMAIL } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe('admin');
    expect(user?.active).toBe(true);
  });

  it('correo fuera de ADMIN_EMAILS → se crea con role=user', async () => {
    process.env.ADMIN_EMAILS = `${ADMIN_TEST_EMAIL}`;
    await db.user.deleteMany({ where: { email: USER_TEST_EMAIL } });

    const res = await POST(
      makeRequest({
        name: TEST_NAME,
        email: USER_TEST_EMAIL,
        password: TEST_PASSWORD,
        acceptTerms: true,
      }),
    );
    expect(res.status).toBe(201);

    const user = await db.user.findUnique({ where: { email: USER_TEST_EMAIL } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe('user');
  });
});
