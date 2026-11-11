/**
 * T5 — Tests de la API de perfil.
 *
 * Cubren:
 *  - GET /api/profile sin sesión → 401
 *  - GET sin perfil guardado → { profile: null }
 *  - PUT válido → 200 y upsert se llama con los datos correctos
 *  - PUT con countryIso inválido → 400 con fieldErrors
 *
 * Mockean @/lib/db por completo; no requieren BD real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks de dependencias (orden importa) ──────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => {
  const findFirstMock = vi.fn();
  const upsertMock = vi.fn().mockResolvedValue({});
  return {
    db: {
      businessProfile: { findFirst: findFirstMock, upsert: upsertMock },
    },
  } as any;
});

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/session')>()) as any;
  return {
    ...mod,
    requireUser: vi.fn(),
  };
});

// ─── Importar bajo mock ──────────────────────────────────────────────────────
import { GET, PUT } from '@/app/api/profile/route';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { db } from '@/lib/db';

const reqUser = vi.mocked(requireUser);
const dbFindFirst = vi.mocked((db as any).businessProfile.findFirst);
const dbUpsert = vi.mocked((db as any).businessProfile.upsert);

const USER = { id: 'usr-profile-1', name: 'Test', email: 'profile@example.com' };

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    dbFindFirst.mockResolvedValue(null);
  });

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await GET({} as any);
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sin perfil guardado → { profile: null }', async () => {
    dbFindFirst.mockResolvedValue(null);
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.profile).toBeNull();
    expect(dbFindFirst).toHaveBeenCalledWith({ where: { userId: USER.id } });
  });

  it('con perfil guardado → { profile: {...} }', async () => {
    const saved = {
      id: 'bp-1',
      userId: USER.id,
      countryIso: 'MX',
      offerType: 'product',
      sector: 'ecommerce',
      sectorOther: null,
      description: 'Vendo zapatos hechos a mano.',
    };
    dbFindFirst.mockResolvedValue(saved);
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.profile).toEqual(saved);
  });
});

describe('PUT /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reqUser.mockResolvedValue(USER as any);
    dbFindFirst.mockResolvedValue(null);
  });

  function makeReq(body: unknown) {
    return { json: vi.fn().mockResolvedValue(body) } as any;
  }

  it('sin sesión → 401', async () => {
    reqUser.mockRejectedValue(new UnauthenticatedError());
    const res = await PUT(makeReq({ countryIso: 'MX' }));
    expect(res.status).toBe(401);
    expect(dbUpsert).not.toHaveBeenCalled();
  });

  it('payload válido → 200 y se ejecuta el upsert', async () => {
    const saved = {
      id: 'bp-new',
      userId: USER.id,
      countryIso: 'MX',
      offerType: 'product' as const,
      sector: 'gastronomia',
      sectorOther: null,
      description: 'Cocina mexicana para eventos.',
    };
    dbUpsert.mockResolvedValue(saved);

    const res = await PUT(makeReq({
      countryIso: 'MX',
      offerType: 'product',
      sector: 'gastronomia',
      description: 'Cocina mexicana para eventos.',
    }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.profile).toEqual(saved);

    expect(dbUpsert).toHaveBeenCalledWith({
      where: { userId: USER.id },
      create: {
        userId: USER.id,
        countryIso: 'MX',
        offerType: 'product',
        sector: 'gastronomia',
        description: 'Cocina mexicana para eventos.',
      },
      update: {
        countryIso: 'MX',
        offerType: 'product',
        sector: 'gastronomia',
        description: 'Cocina mexicana para eventos.',
      },
    });
  });

  it('countryIso inválido → 400 con fieldErrors', async () => {
    const res = await PUT(makeReq({ countryIso: 'XX' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.fieldErrors.countryIso).toBeDefined();
    expect(dbUpsert).not.toHaveBeenCalled();
  });

  it('description demasiado corta → 400', async () => {
    const res = await PUT(makeReq({ description: 'Corto' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION');
    expect(dbUpsert).not.toHaveBeenCalled();
  });
});
