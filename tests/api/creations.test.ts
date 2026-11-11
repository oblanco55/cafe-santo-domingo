/**
 * T5 — Tests de la API de creaciones.
 *
 * Cubren:
 *  - POST /api/creations/[type] sin sesión → 401
 *  - POST payload válido → 201 y se guarda en BD
 *  - POST payload inválido → 400 con fieldErrors, NO se guarda
 *  - POST AI_FAILED → 502, se guarda con status error
 *  - POST rate limit → 429
 *  - POST ruta desconocida → 404
 *  - GET /api/creations/item/[id] → 200 / 401 / 404
 *
 * IMPORTANTE: vitest necesita la BD docker (npm run db:up)
 * solo para los tests de integración. Estos tests mockean
 * @/lib/db por completo, así que NO requieren BD real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks de dependencias (orden importa) ──────────────────────────────────

// 0. auth — mockear para evitar cargar @/lib/db real
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// 0b. db — mock Prisma (ANTES que @/lib/session que lo importa)
vi.mock('@/lib/db', () => {
  const createMock = vi.fn();
  const findFirstMock = vi.fn();
  const upsertMock = vi.fn().mockResolvedValue({});
  const userFindFirst = vi.fn();
  const userCreate = vi.fn();
  return {
    db: {
      creation: { create: createMock, findFirst: findFirstMock },
      businessProfile: { upsert: upsertMock },
      user: { findFirst: userFindFirst, create: userCreate },
      // F2-7a: monetización desactivada por defecto (sin ajustes guardados)
      appSetting: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
});

// 1. rate limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: 0 })),
}));

// 2. engine — mock generateCreation, mantener AIError real
//    (AIError viene de @/lib/ai/errors, no necesita mock)
vi.mock('@/lib/ai/engine', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/ai/engine')>()) as any;
  return {
    ...mod,
    generateCreation: vi.fn(),
  };
});

// 3. session — mock requireUser, mantener clases reales
//    (UnauthenticatedError y ForbiddenError se mantienen del módulo real)
vi.mock('@/lib/session', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/session')>()) as any;
  return {
    ...mod,
    requireUser: vi.fn(),
  };
});

// ─── Importar bajo mock ──────────────────────────────────────────────────────
import { POST } from '@/app/api/creations/[type]/route';
import { GET } from '@/app/api/creations/item/[id]/route';
import { generateCreation } from '@/lib/ai/engine';
import { AIError } from '@/lib/ai/errors';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';

const gen = vi.mocked(generateCreation);
const reqUser = vi.mocked(requireUser);
const rl = vi.mocked(checkRateLimit);
const dbCreate = vi.mocked((db as any).creation.create);
const dbFindFirst = vi.mocked((db as any).creation.findFirst);

const USER = { id: 'usr-t5-user', name: 'Test', email: 't5@example.com' };

function makeReq(body: unknown) {
  return { json: vi.fn().mockResolvedValue(body) } as any;
}

function makeParams(type: string) {
  return { params: Promise.resolve({ type }) } as any;
}

function makeParamsId(id: string) {
  return { params: Promise.resolve({ id }) } as any;
}

const VALID_OUTPUT = {
  title: 'Video de prueba',
  concept: 'Presentación',
  platform: 'tiktok',
  aspect_ratio: '9:16',
  visual_style: 'Limpio',
  script: 'Guion',
  hook: 'Hook',
  cta: 'CTA',
  primary_color: '#fff',
  text_color: '#000',
  negative: 'No',
  duration_text: '30',
};

describe('POST /api/creations/[type]', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    rl.mockReturnValue({ allowed: true, remaining: 19, resetAt: 0 } as any);
    dbCreate.mockResolvedValue({ id: 'crt-t5-1', type: 'video', status: 'ok' } as any);
    dbFindFirst.mockResolvedValue(null);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await POST(makeReq({}), makeParams('video'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('payload válido → 201, resp { id, type, output }, se guarda en BD', async () => {
    const validInput = {
      countryIso: 'MX',
      offerType: 'product',
      sector: 'ecommerce',
      description: 'Vendo zapatos',
      platform: 'tiktok',
      objective: 'presentacion',
      aspectRatio: '9:16',
      duration: 30,
    };
    gen.mockResolvedValue({
      input: validInput,
      output: VALID_OUTPUT,
      model: 'test-model-x',
    } as any);

    const res = await POST(makeReq(validInput), makeParams('video'));
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBe('crt-t5-1');
    expect(body.type).toBe('video');
    expect(body.output).toEqual(VALID_OUTPUT);

    expect(dbCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: USER.id,
        type: 'video',
        status: 'ok',
        model: 'test-model-x',
      }),
    }));
  });

  it('payload inválido → 400 con fieldErrors, NO se guarda', async () => {
    const fe: Record<string, string[]> = { description: ['Es requerido'] };
    gen.mockRejectedValue(
      new AIError('Revisa los datos marcados.', 'VALIDATION', fe),
    );

    const res = await POST(makeReq({ bad: true }), makeParams('video'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.fieldErrors).toEqual(fe);

    expect(dbCreate).not.toHaveBeenCalled();
  });

  it('AI_FAILED → 502 y se guarda con status error', async () => {
    const validInput = { countryIso: 'MX' };
    gen.mockRejectedValue(
      new AIError('El proveedor falló', 'AI_FAILED'),
    );

    const res = await POST(makeReq(validInput), makeParams('video'));
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('AI_FAILED');

    expect(dbCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: USER.id,
        type: 'video',
        status: 'error',
        errorMessage: 'El proveedor falló',
      }),
    }));
  });

  it('rate limit → 429', async () => {
    rl.mockReturnValue({ allowed: false, remaining: 0, resetAt: 99999 } as any);
    const res = await POST(makeReq({}), makeParams('video'));
    expect(res.status).toBe(429);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('RATE_LIMIT');
    expect(gen).not.toHaveBeenCalled();
  });

  it('ruta desconocida → 404', async () => {
    const res = await POST(makeReq({}), makeParams('unknown'));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/creations/item/[id]', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await GET({} as any, makeParamsId('crt-x'));
    expect(res.status).toBe(401);
  });

  it('creación propia → 200 { id, type, input, output, status, createdAt }', async () => {
    const createdAt = new Date('2026-10-22T12:00:00Z');
    const validInput = { countryIso: 'MX', offerType: 'product' };
    dbFindFirst.mockResolvedValue({
      id: 'crt-get-1',
      type: 'video',
      input: validInput,
      output: VALID_OUTPUT,
      status: 'ok',
      errorMessage: null,
      model: 'test',
      userId: USER.id,
      hiddenAt: null,
      createdAt,
    } as any);

    const res = await GET({} as any, makeParamsId('crt-get-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe('crt-get-1');
    expect(body.type).toBe('video');
    expect(body.input).toEqual(validInput);
    expect(body.output).toEqual(VALID_OUTPUT);
    expect(body.status).toBe('ok');
    expect(body.createdAt).toBe(createdAt.toISOString());

    expect(dbFindFirst).toHaveBeenCalledWith({
      where: { id: 'crt-get-1', userId: USER.id, hiddenAt: null },
    });
  });

  it('creación de otro usuario → 404', async () => {
    dbFindFirst.mockResolvedValue(null);
    const res = await GET({} as any, makeParamsId('crt-other'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION');
  });
});
