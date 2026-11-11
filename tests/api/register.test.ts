import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { POST } from '@/app/api/auth/register/route';

/**
 * Tests del handler de registro contra la BD docker.
 * - email duplicado → 409
 * - registro válido → 201 y hash != contraseña
 * - se limpian los registros creados al terminar.
 *
 * IMPORTANTE: vitest tiene su propio proceso; la BD debe estar disponible
 * (npm run db:up) con DATABASE_URL correcto (ver .env).
 */
const TEST_EMAIL = 't3a-auth-test@example.com';
const TEST_NAME = 'Usuario T3a';
const TEST_PASSWORD = 'MiClave1';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  // Limpieza inicial: borrar si quedó de un run anterior
  await db.user.deleteMany({ where: { email: TEST_EMAIL } });
});

afterAll(async () => {
  // Limpieza final: dejar la BD sin el registro de prueba
  await db.user.deleteMany({ where: { email: TEST_EMAIL } });
});

async function reset() {
  await db.user.deleteMany({ where: { email: TEST_EMAIL } });
}

describe('POST /api/auth/register', () => {
  it('devuelve 409 si el email ya existe', async () => {
    await reset();
    await db.user.create({
      data: {
        name: TEST_NAME,
        email: TEST_EMAIL,
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
        termsAcceptedAt: new Date(),
      },
    });

    const res = await POST(
      makeRequest({
        name: TEST_NAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        acceptTerms: true,
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.message).toBe('Ya existe una cuenta con este correo');
  });

  it('devuelve 201 y crea la cuenta con hash distinto de la contraseña', async () => {
    await reset();

    const res = await POST(
      makeRequest({
        name: TEST_NAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        acceptTerms: true,
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const user = await db.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(user).not.toBeNull();
    if (user) {
      expect(user.passwordHash).not.toBe(TEST_PASSWORD);
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(user.name).toBe(TEST_NAME);
      expect(user.termsAcceptedAt instanceof Date).toBe(true);
      // La contraseña original NO debe aparecer en ningún campo guardado
      expect(JSON.stringify(user)).not.toContain(TEST_PASSWORD);
    }
  });

  it('rechaza registros inválidos (zod) con 400', async () => {
    await reset();
    const res = await POST(
      makeRequest({
        name: 'O',
        email: 'no-es-email',
        password: 'corta',
        acceptTerms: false,
      }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
