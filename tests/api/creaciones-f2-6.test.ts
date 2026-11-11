/**
 * F2-6a — APIs de mis creaciones, ocultar y regenerar.
 *
 * Mockea @/lib/db, @/lib/session, @/lib/ai/engine, @/lib/rate-limit y
 * @/lib/billing/entitlements (completo, ya que las nuevas rutas importan
 * checkCanCreate / recordCreationCharge / PAYMENT_REQUIRED_MESSAGE).
 *
 * Requiere BD real: NO. Todo el estado vive en mocks de vi.fn().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks de dependencias ─────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => {
  const createMock = vi.fn();
  const findFirstMock = vi.fn();
  const findManyMock = vi.fn();
  const countMock = vi.fn();
  const updateMock = vi.fn();
  return {
    db: {
      creation: {
        create: createMock,
        findFirst: findFirstMock,
        findMany: findManyMock,
        count: countMock,
        update: updateMock,
        // upsert que el [type]/route.ts de creación usa (no se toca en estos tests,
        // pero el módulo debe existir para que el import no rompa si se agrega en el futuro)
        upsert: vi.fn().mockResolvedValue({}),
      },
      appSetting: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
});

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: 0 })),
}));

vi.mock('@/lib/ai/engine', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/ai/engine')>()) as any;
  return {
    ...mod,
    generateCreation: vi.fn(),
  };
});

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/session')>()) as any;
  return {
    ...mod,
    requireUser: vi.fn(),
  };
});

// ─── Billing: mockea TODO @/lib/billing/entitlements ─────────────────────
vi.mock('@/lib/billing/entitlements', () => {
  const checkCanCreate = vi.fn(async () => ({ allowed: true, source: 'disabled' as const }));
  const recordCreationCharge = vi.fn(async () => {});
  return {
    checkCanCreate,
    recordCreationCharge,
    PAYMENT_REQUIRED_MESSAGE: 'Alcanzaste tu límite gratuito. Elige un plan o un paquete de créditos para seguir creando.',
  };
});

// ─── Importar bajo mock ──────────────────────────────────────────────────
import { GET as LIST_GET } from '@/app/api/creations/route';
import { GET as ITEM_GET, DELETE as ITEM_DELETE } from '@/app/api/creations/item/[id]/route';
import { POST as REGEN_POST } from '@/app/api/creations/item/[id]/regenerate/route';

import { generateCreation } from '@/lib/ai/engine';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  checkCanCreate,
  recordCreationCharge,
} from '@/lib/billing/entitlements';
import { db } from '@/lib/db';

const gen = vi.mocked(generateCreation);
const reqUser = vi.mocked(requireUser);
const rl = vi.mocked(checkRateLimit);
const cc = vi.mocked(checkCanCreate);
const charge = vi.mocked(recordCreationCharge);

const dbCreate = vi.mocked((db as any).creation.create);
const dbFindFirst = vi.mocked((db as any).creation.findFirst);
const dbFindMany = vi.mocked((db as any).creation.findMany);
const dbCount = vi.mocked((db as any).creation.count);
const dbUpdate = vi.mocked((db as any).creation.update);

const USER = { id: 'usr-f2-6', role: 'user' };

function makeReq(search = '') {
  const url = new URL(`http://localhost/api/creations${search}`);
  return { nextUrl: url } as any;
}

function makeParamsId(id: string) {
  return { params: Promise.resolve({ id }) } as any;
}

const VALID_OUTPUT = {
  title: 'Mi video',
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

describe('GET /api/creations — lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    dbFindMany.mockResolvedValue([]);
    dbCount.mockResolvedValue(0);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await LIST_GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sin parámetros → solo propias y no ocultas (200, items vacíos)', async () => {
    const res = await LIST_GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.count).toBe(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.items).toEqual([]);

    // La consulta filtró por userId, status ok y hiddenAt null
    expect(dbCount).toHaveBeenCalledWith({
      where: { userId: USER.id, status: 'ok', hiddenAt: null },
    });
    expect(dbFindMany).toHaveBeenCalledWith({
      where: { userId: USER.id, status: 'ok', hiddenAt: null },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('con type=video y page=2 → filtra por type, skip 20', async () => {
    const res = await LIST_GET(makeReq('?type=video&page=2'));
    expect(res.status).toBe(200);
    expect(dbCount).toHaveBeenCalledWith({
      where: { userId: USER.id, status: 'ok', hiddenAt: null, type: 'video' },
    });
    expect(dbFindMany).toHaveBeenCalledWith({
      where: { userId: USER.id, status: 'ok', hiddenAt: null, type: 'video' },
      orderBy: { createdAt: 'desc' },
      skip: 20,
      take: 20,
    });
  });

  it('muestra solo creaciones propias / no ocultas (filter en BD), con title y platform', async () => {
    const createdAt = new Date('2026-10-22T12:00:00Z');
    dbFindMany.mockResolvedValue([
      {
        id: 'crt-a',
        type: 'video',
        input: { platform: 'tiktok' },
        output: { title: 'Título A' },
        createdAt,
        parentId: null,
      },
      {
        id: 'crt-b',
        type: 'photo',
        input: { platform: null },
        output: null,
        createdAt,
        parentId: 'crt-a',
      },
    ]);
    dbCount.mockResolvedValue(2);

    const res = await LIST_GET(makeReq());
    const body = (await res.json()) as any;
    expect(body.count).toBe(2);
    expect(body.items).toEqual([
      {
        id: 'crt-a',
        type: 'video',
        title: 'Título A',
        platform: 'tiktok',
        createdAt: createdAt.toISOString(),
        parentId: null,
      },
      {
        id: 'crt-b',
        type: 'photo',
        title: null,
        platform: null,
        createdAt: createdAt.toISOString(),
        parentId: 'crt-a',
      },
    ]);
  });
});

describe('GET /api/creations/item/[id] — con hiddenAt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
  });

  it('oculta (hiddenAt != null) → 404', async () => {
    dbFindFirst.mockResolvedValue({
      id: 'crt-hid',
      userId: USER.id,
      hiddenAt: new Date('2026-10-23T09:00:00Z'),
    } as any);
    const res = await ITEM_GET({} as any, makeParamsId('crt-hid'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION');
  });
});

describe('DELETE /api/creations/item/[id] — ocultar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
  });

  it('propia → 200 { ok: true } y update(hiddenAt)', async () => {
    dbFindFirst.mockResolvedValue({
      id: 'crt-del-1',
      userId: USER.id,
      hiddenAt: null,
    } as any);
    dbUpdate.mockResolvedValue({ id: 'crt-del-1' } as any);

    const res = await ITEM_DELETE({} as any, makeParamsId('crt-del-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(dbUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'crt-del-1' },
        data: expect.objectContaining({ hiddenAt: expect.any(Date) }),
      }),
    );
  });

  it('de otro usuario (findFirst null) → 404 y NO llama update', async () => {
    dbFindFirst.mockResolvedValue(null);
    const res = await ITEM_DELETE({} as any, makeParamsId('crt-other'));
    expect(res.status).toBe(404);
    expect(dbUpdate).not.toHaveBeenCalled();
  });
});

describe('POST /api/creations/item/[id]/regenerate', () => {
  const PARENT = {
    id: 'crt-parent-1',
    userId: USER.id,
    type: 'video',
    input: { countryIso: 'MX', platform: 'tiktok' },
    output: VALID_OUTPUT,
    status: 'ok',
    hiddenAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    rl.mockReturnValue({ allowed: true, remaining: 19, resetAt: 0 } as any);
    cc.mockResolvedValue({ allowed: true, source: 'disabled' });
    dbFindFirst.mockResolvedValue(PARENT as any);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await REGEN_POST({} as any, makeParamsId('crt-x'));
    expect(res.status).toBe(401);
    expect(gen).not.toHaveBeenCalled();
  });

  it('creación no existe / de otro → 404, no llama a generateCreation', async () => {
    dbFindFirst.mockResolvedValue(null);
    const res = await REGEN_POST({} as any, makeParamsId('crt-other'));
    expect(res.status).toBe(404);
    expect(gen).not.toHaveBeenCalled();
  });

  it('oculta → 404 (findFirst con hiddenAt != null devuelve null)', async () => {
    dbFindFirst.mockResolvedValue(null);
    const res = await REGEN_POST({} as any, makeParamsId('crt-hid'));
    expect(res.status).toBe(404);
    // La cláusula where debe excluir ocultas:
    expect(dbFindFirst).toHaveBeenCalledWith({
      where: { id: 'crt-hid', userId: USER.id, hiddenAt: null },
    });
    expect(gen).not.toHaveBeenCalled();
  });

  it('rate limit → 429', async () => {
    rl.mockReturnValue({ allowed: false, remaining: 0, resetAt: 99999 } as any);
    const res = await REGEN_POST({} as any, makeParamsId('crt-parent-1'));
    expect(res.status).toBe(429);
    expect(gen).not.toHaveBeenCalled();
  });

  it('checkCanCreate { allowed:false } → 402 y NO llama a generateCreation', async () => {
    cc.mockResolvedValue({ allowed: false });
    const res = await REGEN_POST({} as any, makeParamsId('crt-parent-1'));
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('PAYMENT_REQUIRED');
    expect(gen).not.toHaveBeenCalled();
    expect(dbCreate).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it('exito: genera hijo con parentId, resp { id, type, output }, cargo y billingSource', async () => {
    gen.mockResolvedValue({
      input: PARENT.input,
      output: VALID_OUTPUT,
      model: 'test-model',
    } as any);
    cc.mockResolvedValue({ allowed: true, source: 'credit' });
    dbCreate.mockResolvedValue({ id: 'crt-child-1', type: 'video', status: 'ok' } as any);

    const res = await REGEN_POST({} as any, makeParamsId('crt-parent-1'));
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.id).toBe('crt-child-1');
    expect(body.type).toBe('video');
    expect(body.output).toEqual(VALID_OUTPUT);

    // Se guardó el hijo con parentId = id padre y el billingSource de la comprobación
    expect(gen).toHaveBeenCalledWith(PARENT.type, PARENT.input);
    expect(dbCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER.id,
          type: 'video',
          status: 'ok',
          parentId: 'crt-parent-1',
          billingSource: 'credit',
        }),
      }),
    );
    // Se registró el cargo (solo credit → sí; si hubiera sido 'free'/'disabled' no)
    expect(charge).toHaveBeenCalledWith(USER.id, 'crt-child-1', 'credit');
  });

  it('AI_FAILED → 502, se guarda status error, NO consume ni cargo', async () => {
    gen.mockRejectedValue(new (await import('@/lib/ai/errors')).AIError('Provedor falló', 'AI_FAILED'));
    const res = await REGEN_POST({} as any, makeParamsId('crt-parent-1'));
    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('AI_FAILED');

    expect(dbCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER.id,
          type: 'video',
          status: 'error',
          errorMessage: 'Provedor falló',
          parentId: 'crt-parent-1',
        }),
      }),
    );
    // Un fallo NO consume derecho ni genera cargo.
    expect(charge).not.toHaveBeenCalled();
  });
});
