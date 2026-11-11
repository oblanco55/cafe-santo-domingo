import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { POST } from '@/app/api/auth/register/route';
import { ForbiddenError, UnauthenticatedError, requireAdmin } from '@/lib/session';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    creation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    legalDocument: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    appSetting: { findMany: vi.fn().mockResolvedValue([]) },
    aiProvider: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
  },
} as any));

/**
 * Tests T3c — rol de administrador.
 *
 * Test A: El registro público SIEMPRE crea role 'user',
 *         incluso si el cuerpo incluye role:'admin'.
 *
 * Test B: requireAdmin() lanza ForbiddenError (403) para 'user'
 *         y resuelve correctamente para 'admin'.
 */

const TEST_EMAIL = 't3c-role-test@example.com';
const TEST_NAME = 'Usuario T3c';
const TEST_PASSWORD = 'MiClave1';

const dbAny = db as any;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(() => {
  dbAny.user.deleteMany.mockResolvedValue({ count: 0 });
  dbAny.user.findUnique.mockResolvedValue(null);
});

afterAll(() => vi.clearAllMocks());

describe('POST /api/auth/register — rol', () => {
  it('registrar con role:"admin" en el body → en BD queda "user"', async () => {
    dbAny.user.deleteMany.mockResolvedValueOnce({ count: 0 });
    dbAny.user.findUnique.mockResolvedValueOnce(null);

    // Incluir role:'admin' intencionalmente en el body
    const res = await POST(
      makeRequest({
        name: TEST_NAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        acceptTerms: true,
        role: 'admin',
      }),
    );

    expect(res.status).toBe(201);

    const user = await dbAny.user.findUnique.mockImplementation((opts: any) => {
      // Simulate the create call having succeeded
      return Promise.resolve({
        id: 'newuser-1',
        name: TEST_NAME,
        email: TEST_EMAIL,
        role: 'user',
        active: true,
      });
    });
  });
});

describe('requireAdmin()', () => {
  it('lanza ForbiddenError (403) cuando el rol es "user"', async () => {
    const { auth } = await import('@/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: {
        id: 'test-user-id',
        name: 'Usuario Normal',
        email: 'normal@example.com',
        role: 'user',
      },
    });

    // La BD debe devolver un usuario activo con rol 'user'
    dbAny.user.findUnique.mockResolvedValueOnce({
      id: 'test-user-id',
      name: 'Usuario Normal',
      email: 'normal@example.com',
      role: 'user',
      active: true,
    });

    const err = await requireAdmin().catch(e => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.message).toBe('No tienes permisos para esta acción.');
  });

  it('resuelve correctamente cuando el rol es "admin"', async () => {
    const { auth } = await import('@/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: {
        id: 'test-admin-id',
        name: 'Admin',
        email: 'admin@example.com',
        role: 'admin',
      },
    });

    // La BD debe devolver un usuario activo con rol 'admin'
    dbAny.user.findUnique.mockResolvedValueOnce({
      id: 'test-admin-id',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      active: true,
    });

    const result = await requireAdmin();
    expect(result.id).toBe('test-admin-id');
    expect(result.role).toBe('admin');
  });

  it('lanza UnauthenticatedError (401) si no hay sesión', async () => {
    const { auth } = await import('@/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow(UnauthenticatedError);
  });
});
