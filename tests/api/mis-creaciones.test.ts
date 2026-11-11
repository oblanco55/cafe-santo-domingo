/**
 * F2-6b — Tests de las APIs de Mis creaciones (lista, detalle, delete).
 *
 * Cubren:
 *  - GET /api/creations (lista):
 *    - sin sesión → 401
 *    - con items → 200 { count, page, pageSize, items }
 *    - con filtro type → solo ese tipo
 *    - sin items → 200 { count: 0, items: [] }
 *  - DELETE /api/creations/item/[id]:
 *    - sin sesión → 401
 *    - soft delete → 200 { ok: true }, hiddenAt se actualiza
 *    - no existe → 404
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (mismo patrón que creations.test.ts) ─────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => {
  return {
    db: {
      creation: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
      businessProfile: { upsert: vi.fn().mockResolvedValue({}) },
      user: { findFirst: vi.fn(), create: vi.fn() },
      appSetting: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
});

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: 0 })),
}));

vi.mock('@/lib/ai/engine', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/ai/engine')>()) as any;
  return { ...mod, generateCreation: vi.fn() };
});

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/session')>()) as any;
  return { ...mod, requireUser: vi.fn() };
});

// ─── Importar bajo mock ─────────────────────────────────────────────────────

import { GET as listGet } from '@/app/api/creations/route';
import { DELETE, GET as itemGet } from '@/app/api/creations/item/[id]/route';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { db } from '@/lib/db';

const reqUser = vi.mocked(requireUser);
const dbCount = vi.mocked((db as any).creation.count);
const dbFindMany = vi.mocked((db as any).creation.findMany);
const dbFindFirst = vi.mocked((db as any).creation.findFirst);
const dbUpdate = vi.mocked((db as any).creation.update);

const USER = { id: 'usr-f26b', name: 'Test', email: 'f26b@example.com' };

function makeReq(search: string) {
  return { nextUrl: new URL(`http://localhost${search}`, 'http://localhost') } as any;
}

function makeParamsId(id: string) {
  return { params: Promise.resolve({ id }) } as any;
}

describe('GET /api/creations (lista)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    dbCount.mockResolvedValue(0);
    dbFindMany.mockResolvedValue([]);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await listGet(makeReq('/api/creations'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('con items → 200 { count, page, pageSize, items[] }', async () => {
    const createdAt = new Date('2026-10-22T12:00:00Z');
    dbCount.mockResolvedValue(2);
    dbFindMany.mockResolvedValue([
      { id: 'crt-1', type: 'video', output: { title: 'V1' }, input: { platform: 'tiktok' }, createdAt, parentId: null },
      { id: 'crt-2', type: 'photo', output: { title: 'P1' }, input: { platform: 'instagram' }, createdAt, parentId: null },
    ] as any);

    const res = await listGet(makeReq('/api/creations'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.count).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      id: 'crt-1',
      type: 'video',
      title: 'V1',
      platform: 'tiktok',
      parentId: null,
    });
    expect(body.items[1]).toMatchObject({
      id: 'crt-2',
      type: 'photo',
      title: 'P1',
      platform: 'instagram',
    });
  });

  it('con filtro type=photo → solo photo', async () => {
    const createdAt = new Date('2026-10-22T12:00:00Z');
    dbCount.mockResolvedValue(1);
    dbFindMany.mockResolvedValue([
      { id: 'crt-3', type: 'photo', output: { title: 'F1' }, input: {}, createdAt, parentId: null },
    ] as any);

    const res = await listGet(makeReq('/api/creations?type=photo'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe('photo');
  });

  it('sin items → 200 { count: 0, items: [] }', async () => {
    dbCount.mockResolvedValue(0);
    dbFindMany.mockResolvedValue([]);

    const res = await listGet(makeReq('/api/creations'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.count).toBe(0);
    expect(body.items).toEqual([]);
  });

  it('tipo inválido en query → se ignora (no error)', async () => {
    const createdAt = new Date('2026-10-22T12:00:00Z');
    dbCount.mockResolvedValue(1);
    dbFindMany.mockResolvedValue([
      { id: 'crt-4', type: 'video', output: { title: 'V' }, input: {}, createdAt, parentId: null },
    ] as any);

    const res = await listGet(makeReq('/api/creations?type=bogus'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items).toHaveLength(1);
  });
});

describe('DELETE /api/creations/item/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    dbFindFirst.mockResolvedValue(null);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await DELETE({} as any, makeParamsId('crt-x'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('soft delete → 200 { ok: true }, update se llama con hiddenAt', async () => {
    dbFindFirst.mockResolvedValue({
      id: 'crt-del-1',
      type: 'video',
      input: null,
      output: null,
      status: 'ok',
      errorMessage: null,
      model: 'test',
      userId: USER.id,
      hiddenAt: null,
      createdAt: new Date(),
    } as any);

    const res = await DELETE({} as any, makeParamsId('crt-del-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);

    expect(dbUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'crt-del-1' },
        data: expect.objectContaining({ hiddenAt: expect.any(Date) }),
      })
    );
  });

  it('no existe → 404', async () => {
    dbFindFirst.mockResolvedValue(null);
    const res = await DELETE({} as any, makeParamsId('crt-missing'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION');
  });

  it('de otro usuario → 404', async () => {
    // findFirst devuelve null porque userId no coincide
    dbFindFirst.mockResolvedValue(null);
    const res = await DELETE({} as any, makeParamsId('crt-other-user'));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/creations/item/[id] (detalle)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    dbFindFirst.mockResolvedValue(null);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await itemGet({} as any, makeParamsId('crt-x'));
    expect(res.status).toBe(401);
  });

  it('creación propia → 200 con todos los campos', async () => {
    const createdAt = new Date('2026-10-22T12:00:00Z');
    const validInput = { countryIso: 'MX', platform: 'tiktok' };
    const validOutput = { title: 'Guion video', concept: 'Presentación' };
    dbFindFirst.mockResolvedValue({
      id: 'crt-detail-1',
      type: 'video',
      input: validInput,
      output: validOutput,
      status: 'ok',
      errorMessage: null,
      model: 'test',
      userId: USER.id,
      hiddenAt: null,
      parentId: null,
      createdAt,
    } as any);

    const res = await itemGet({} as any, makeParamsId('crt-detail-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe('crt-detail-1');
    expect(body.type).toBe('video');
    expect(body.input).toEqual(validInput);
    expect(body.output).toEqual(validOutput);
    expect(body.status).toBe('ok');
    expect(body.parentId).toBe(null);
  });

  it('oculta → 404', async () => {
    dbFindFirst.mockResolvedValue(null);
    const res = await itemGet({} as any, makeParamsId('crt-hidden'));
    expect(res.status).toBe(404);
  });
});
