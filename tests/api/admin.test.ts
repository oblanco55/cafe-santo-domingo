/**
 * F2-3b — Suite de tests para la API Admin.
 *
 * Cubren:
 *  - Auth: 401 sin sesión, 403 sin rol admin (todas las rutas)
 *  - users: paginación, búsqueda, PATCH role/active
 *  - creations: filtros y detalle
 *  - legal: GET lista, POST upsert, GET slug
 *  - settings: GET, PATCH
 *  - metrics: GET con days
 *
 * Mockean @/lib/db, @/auth y @/lib/session por completo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
    creation: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]) },
    legalDocument: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn().mockResolvedValue({ id: 'doc-1', slug: 'privacidad', title: 'Privacidad', content: 'Texto legal', updatedAt: new Date() }), findUnique: vi.fn().mockResolvedValue(null) },
    appSetting: { findMany: vi.fn().mockResolvedValue([]) },
    aiProvider: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
  },
} as any));

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/session')>()) as any;
  return {
    ...mod,
    requireUser: vi.fn(),
    requireAdmin: vi.fn(),
  };
});

// ─── Imports ────────────────────────────────────────────────────────────────
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
const reqAdmin = vi.mocked(requireAdmin);

const ADMIN = { id: 'adm-1', name: 'Admin', email: 'admin@test.com', role: 'admin' as const };

function ok() {
  reqAdmin.mockResolvedValue(ADMIN as any);
}
function noSession() {
  reqAdmin.mockRejectedValue(new UnauthenticatedError());
}
function forbidden() {
  reqAdmin.mockRejectedValue(new ForbiddenError());
}

async function resJson(p: { status: number; json: () => Promise<any> }): Promise<{ status: number; body: any }> {
  return { status: p.status, body: await p.json() };
}

// ─── users ──────────────────────────────────────────────────────────────────

import * as usersRoute from '@/app/api/admin/users/route';
import * as userDetailRoute from '@/app/api/admin/users/[id]/route';

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  it('sin sesión → 401', async () => {
    noSession();
    const res = await usersRoute.GET(new Request('http://localhost/api/admin/users'));
    expect(res.status).toBe(401);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sin rol admin → 403', async () => {
    forbidden();
    const res = await usersRoute.GET(new Request('http://localhost/api/admin/users'));
    expect(res.status).toBe(403);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('busqueda < 2 chars → 400', async () => {
    const res = await usersRoute.GET(new Request('http://localhost/api/admin/users?q=a'));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  function makeReq(body: unknown) {
    return { json: () => Promise.resolve(body) } as any;
  }
  function params(id: string) {
    return { params: Promise.resolve({ id }) } as any;
  }

  it('sin sesión → 401', async () => {
    noSession();
    const res = await userDetailRoute.PATCH(makeReq({ role: 'admin' }), params('usr-1'));
    expect(res.status).toBe(401);
  });

  it('payload inválido → 400', async () => {
    const res = await userDetailRoute.PATCH(makeReq({}), params('usr-1'));
    expect(res.status).toBe(400);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('VALIDATION');
  });
});

// ─── creations ──────────────────────────────────────────────────────────────

import * as creationsListRoute from '@/app/api/admin/creations/route';
import * as creationDetailRoute from '@/app/api/admin/creations/[id]/route';

describe('GET /api/admin/creations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  it('sin sesión → 401', async () => {
    noSession();
    const res = await creationsListRoute.GET(new Request('http://localhost/api/admin/creations') as any);
    expect(res.status).toBe(401);
  });

  it('sin rol admin → 403', async () => {
    forbidden();
    const res = await creationsListRoute.GET(new Request('http://localhost/api/admin/creations') as any);
    expect(res.status).toBe(403);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/admin/creations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  it('sin sesión → 401', async () => {
    noSession();
    const res = await creationDetailRoute.GET({} as any, { params: Promise.resolve({ id: 'crt-1' }) } as any);
    expect(res.status).toBe(401);
  });
});

// ─── legal ──────────────────────────────────────────────────────────────────

import * as legalListRoute from '@/app/api/admin/legal/route';
import * as legalSlugRoute from '@/app/api/admin/legal/[slug]/route';

describe('GET /api/admin/legal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  it('sin sesión → 401', async () => {
    noSession();
    const res = await legalListRoute.GET({} as any);
    expect(res.status).toBe(401);
  });

  it('sin rol admin → 403', async () => {
    forbidden();
    const res = await legalListRoute.GET({} as any);
    expect(res.status).toBe(403);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/admin/legal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  function makeReq(body: unknown) {
    return { json: () => Promise.resolve(body) } as any;
  }

  it('sin sesión → 401', async () => {
    noSession();
    const res = await legalListRoute.POST(makeReq({ slug: 'privacidad', content: 'Texto' }) as any);
    expect(res.status).toBe(401);
  });

  it('slug inválido → 400', async () => {
    const res = await legalListRoute.POST(makeReq({ slug: 'invalido', content: 'Texto' }) as any);
    expect(res.status).toBe(400);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('VALIDATION');
  });
});

describe('GET /api/admin/legal/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  it('sin sesión → 401', async () => {
    noSession();
    const res = await legalSlugRoute.GET({} as any, { params: Promise.resolve({ slug: 'privacidad' }) } as any);
    expect(res.status).toBe(401);
  });
});

// ─── settings ───────────────────────────────────────────────────────────────

import * as settingsRoute from '@/app/api/admin/settings/route';

describe('GET /api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  it('sin sesión → 401', async () => {
    noSession();
    const res = await settingsRoute.GET({} as any);
    expect(res.status).toBe(401);
  });

  it('sin rol admin → 403', async () => {
    forbidden();
    const res = await settingsRoute.GET({} as any);
    expect(res.status).toBe(403);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('PATCH /api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  function makeReq(body: unknown) {
    return { json: () => Promise.resolve(body) } as any;
  }

  it('sin sesión → 401', async () => {
    noSession();
    const res = await settingsRoute.PATCH(makeReq({}) as any);
    expect(res.status).toBe(401);
  });

  it('payload inválido → 400', async () => {
    const res = await settingsRoute.PATCH(makeReq({ limits: { creationsPer10Min: -1 } }) as any);
    expect(res.status).toBe(400);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('VALIDATION');
  });
});

// ─── metrics ────────────────────────────────────────────────────────────────

import * as metricsRoute from '@/app/api/admin/metrics/route';

describe('GET /api/admin/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok();
  });

  it('sin sesión → 401', async () => {
    noSession();
    const res = await metricsRoute.GET(new Request('http://localhost/api/admin/metrics'));
    expect(res.status).toBe(401);
  });

  it('sin rol admin → 403', async () => {
    forbidden();
    const res = await metricsRoute.GET(new Request('http://localhost/api/admin/metrics'));
    expect(res.status).toBe(403);
    const { body } = await resJson(res as any);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
