/**
 * F2-3d — Suite de tests de seguridad (según ordenes/F2-3d-seguridad.md).
 *
 * Cubren:
 *  1. GET /api/legal/[slug] con slugs "terminos", "privacidad" y un slug inválido
 *  2. requireUser / requireAdmin: sin sesión → 401, rol 'user' → 403, rol 'admin' → 200
 *     (+ usuario inactivo en BD → 401)
 *  3. POST /api/admin/legal: sin sesión → 401, payload inválido → 400
 *  4. AIError: los mensajes de error de la API NO exponen credenciales
 *  5. safeApiError (src/lib/utils.ts) y aiErrorMessage: sanitización
 *  6. AdminError: errores no-IA en src/lib/admin.ts
 *
 * Mockea @/lib/db y @/auth; NO requiere BD.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
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

// ─── Imports ────────────────────────────────────────────────────────────────
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  requireUser,
  requireAdmin,
  UnauthenticatedError,
  ForbiddenError,
} from '@/lib/session';
import { AIError } from '@/lib/ai/errors';
import { AdminError } from '@/lib/admin-errors';
import { aiErrorMessage, safeApiError } from '@/lib/utils';
import { adminErrorResponse, AdminValidationError } from '@/lib/admin-utils';
import * as legalSlugPublic from '@/app/api/legal/[slug]/route';
import * as legalAdmin from '@/app/api/admin/legal/route';

const authMock = auth as ReturnType<typeof vi.fn>;
const dbAny = db as any;

const ADMIN_SESSION = { user: { id: 'adm-1', name: 'Admin', email: 'admin@test.com', role: 'admin' as const } };
const USER_SESSION = { user: { id: 'usr-1', name: 'User', email: 'user@test.com', role: 'user' as const } };

// Usuario activo en BD para requireUser/requireAdmin
const USER_DB_ACTIVE = { id: 'usr-1', name: 'User', email: 'user@test.com', role: 'user', active: true };
const ADMIN_DB_ACTIVE = { id: 'adm-1', name: 'Admin', email: 'admin@test.com', role: 'admin', active: true };
const USER_DB_INACTIVE = { id: 'usr-1', name: 'User', email: 'user@test.com', role: 'user', active: false };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(null);
  dbAny.legalDocument.findFirst.mockReset();
  dbAny.legalDocument.findFirst.mockResolvedValue(null);
  dbAny.legalDocument.upsert.mockReset();
  dbAny.user.findUnique.mockReset();
  dbAny.user.findUnique.mockResolvedValue(null);
});

// ─── Punto 1: GET /api/legal/[slug] ─────────────────────────────────────────

describe('GET /api/legal/[slug] (público) — punto 1', () => {
  it('slug "terminos" con documento → 200 y devuelve doc', async () => {
    dbAny.legalDocument.findFirst.mockResolvedValueOnce({
      id: 'doc-1',
      slug: 'terminos',
      title: 'Términos y Condiciones',
      content: 'Términos de uso de la plataforma',
      version: 1,
      updatedAt: new Date(),
      updatedBy: 'adm-1',
    });
    const res = await legalSlugPublic.GET({} as any, { params: Promise.resolve({ slug: 'terminos' }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Términos y Condiciones');
    expect(body.content).toBe('Términos de uso de la plataforma');
    expect(body.version).toBe(1);
  });

  it('slug "privacidad" con documento → 200 y devuelve doc', async () => {
    dbAny.legalDocument.findFirst.mockResolvedValueOnce({
      id: 'doc-2',
      slug: 'privacidad',
      title: 'Política de Privacidad',
      content: 'Cómo tratamos tus datos personales',
      version: 3,
      updatedAt: new Date(),
      updatedBy: 'adm-1',
    });
    const res = await legalSlugPublic.GET({} as any, { params: Promise.resolve({ slug: 'privacidad' }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Política de Privacidad');
    expect(body.version).toBe(3);
  });

  it('slug "terms" (antiguo, ya no válido) → 404', async () => {
    const res = await legalSlugPublic.GET({} as any, { params: Promise.resolve({ slug: 'terms' }) } as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('slug "privacy" (antiguo, ya no válido) → 404', async () => {
    const res = await legalSlugPublic.GET({} as any, { params: Promise.resolve({ slug: 'privacy' }) } as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('slug inválido ("hacking") → 404, sin info leak', async () => {
    const res = await legalSlugPublic.GET({} as any, { params: Promise.resolve({ slug: 'hacking' }) } as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    const msg = JSON.stringify(body);
    expect(msg.toLowerCase()).not.toContain('sk-');
    expect(msg).not.toMatch(/Bearer\s+\w+/i);
    expect(msg).not.toMatch(/at\s+\w+\s*\(/i);
    expect(body.error.code).toBe('VALIDATION');
  });

  it('slug "terminos" sin documento → 404, sin info leak', async () => {
    dbAny.legalDocument.findFirst.mockResolvedValueOnce(null);
    const res = await legalSlugPublic.GET({} as any, { params: Promise.resolve({ slug: 'terminos' }) } as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    const msg = JSON.stringify(body);
    expect(msg).not.toMatch(/at\s+\w+\s*\(/i);
  });
});

// ─── Punto 2: requireUser / requireAdmin ────────────────────────────────────

describe('requireUser (control de acceso) — punto 2', () => {
  it('sin sesión → UnauthenticatedError (401)', async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
    const e = new UnauthenticatedError();
    expect(e.status).toBe(401);
    expect(e.body.error.code).toBe('UNAUTHORIZED');
  });

  it('con sesión válida y usuario activo en BD → resuelve el usuario', async () => {
    authMock.mockResolvedValueOnce(USER_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...USER_DB_ACTIVE });
    const result = await requireUser();
    expect(result.id).toBe('usr-1');
    expect(result.role).toBe('user');
    expect(result.email).toBe('user@test.com');
  });

  it('usuario inactivo en BD → UnauthenticatedError (401)', async () => {
    authMock.mockResolvedValueOnce(USER_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...USER_DB_INACTIVE });
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('usuario inexistente en BD → UnauthenticatedError (401)', async () => {
    authMock.mockResolvedValueOnce(USER_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('requireAdmin (control de acceso) — punto 2', () => {
  it('sin sesión → UnauthenticatedError (401)', async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthenticatedError);
    const e = new UnauthenticatedError();
    expect(e.status).toBe(401);
    expect(e.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rol "user" → ForbiddenError (403)', async () => {
    authMock.mockResolvedValueOnce(USER_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...USER_DB_ACTIVE });
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
    const e = new ForbiddenError();
    expect(e.status).toBe(403);
    expect(e.body.error.code).toBe('FORBIDDEN');
  });

  it('rol "admin" → resuelve correctamente', async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...ADMIN_DB_ACTIVE });
    const result = await requireAdmin();
    expect(result.id).toBe('adm-1');
    expect(result.role).toBe('admin');
  });

  it('token con rol admin pero BD con rol user → ForbiddenError (403)', async () => {
    // Simula un token con rol admin pero la BD dice que es user
    authMock.mockResolvedValueOnce({ user: { id: 'user-2', name: 'Hacker', email: 'h@t.com', role: 'admin' } });
    dbAny.user.findUnique.mockResolvedValueOnce({ id: 'user-2', name: 'Hacker', email: 'h@t.com', role: 'user', active: true });
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── Punto 3: POST /api/admin/legal ─────────────────────────────────────────

describe('POST /api/admin/legal (admin) — punto 3', () => {
  function makeReq(body: unknown) {
    return {
      json: () => Promise.resolve(body),
      headers: { get: () => null },
    } as any;
  }

  it('sin sesión → 401 UNAUTHORIZED', async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await legalAdmin.POST(makeReq({ slug: 'terminos', content: 'Texto' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sin rol admin (usuario regular activo) → 403 FORBIDDEN', async () => {
    authMock.mockResolvedValueOnce(USER_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...USER_DB_ACTIVE });
    const res = await legalAdmin.POST(makeReq({ slug: 'terminos', content: 'Texto' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('payload inválido (slug "terms" ya no válido) → 400 VALIDATION, sin upsert', async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...ADMIN_DB_ACTIVE });
    const upsertSpy = vi.fn();
    dbAny.legalDocument.upsert = upsertSpy;
    const res = await legalAdmin.POST(makeReq({ slug: 'terms', content: 'Texto' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('payload inválido (slug "hacking") → 400 VALIDATION', async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...ADMIN_DB_ACTIVE });
    const res = await legalAdmin.POST(makeReq({ slug: 'hacking', content: 'Texto' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('payload inválido (content vacío) → 400 VALIDATION', async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...ADMIN_DB_ACTIVE });
    const res = await legalAdmin.POST(makeReq({ slug: 'terminos', content: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('payload válido → 200, upsert se llama, document en body', async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    dbAny.user.findUnique.mockResolvedValueOnce({ ...ADMIN_DB_ACTIVE });
    const upsertResult = {
      id: 'doc-1',
      slug: 'terminos',
      title: 'Términos y Condiciones',
      content: 'Texto nuevo',
      version: 1,
      updatedAt: new Date(),
      updatedBy: 'adm-1',
    };
    const upsertSpy = vi.fn().mockResolvedValue(upsertResult);
    dbAny.legalDocument.upsert = upsertSpy;
    dbAny.auditLog.create = vi.fn().mockResolvedValue({ id: 1 });
    const res = await legalAdmin.POST(makeReq({ slug: 'terminos', content: 'Texto nuevo', title: 'Términos y Condiciones' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.document?.slug).toBe('terminos');
    expect(body.document?.content).toBe('Texto nuevo');
    expect(upsertSpy).toHaveBeenCalled();
  });
});

// ─── Punto 4: AIError no expone credenciales ────────────────────────────────

describe('AIError y sanitización de mensajes — punto 4', () => {
  const SECRET_CREDENTIALS = [
    'ANTH_ROPIC_KEY_1234567890abcdef',
    'GEMINI_API_KEY_0123456789abcdef',
    'OPEN_AI_0123456789abcdef',
    'sk-anthropic-abcd1234567890abcdef',
  ];

  it('aiErrorMessage(): nunca devuelve el mensaje interno del proveedor', () => {
    const err1 = new AIError(
      'timeout: connection to api.example.com/v1 failed, token sk-anthropic-abcd1234567890abcdef expired',
      'AI_FAILED',
    );
    const msg1 = aiErrorMessage(err1);
    expect(msg1).not.toContain('sk-anthropic-abcd1234567890abcdef');
    expect(msg1).not.toContain('api.example.com');
    expect(msg1).toMatch(/servicio de IA|Inténtalo/i);
  });

  it('aiErrorMessage(): RATE_LIMIT devuelve mensaje genérico', () => {
    const err = new AIError('rate limit exceeded, retry-after: 60, key: GEMINI_API_KEY_0123456789abcdef', 'RATE_LIMIT');
    const msg = aiErrorMessage(err);
    expect(msg).not.toContain('GEMINI_API_KEY_0123456789abcdef');
    expect(msg).not.toContain('retry-after');
    expect(msg).toMatch(/límite|espera|segundos/i);
  });

  it('aiErrorMessage(): nunca filtra credenciales del mensaje original', () => {
    for (const cred of SECRET_CREDENTIALS) {
      const err = new AIError(`provider rejected request (key: ${cred}, url=https://api.example.com/v1)`, 'AI_FAILED');
      const msg = aiErrorMessage(err);
      expect(msg, `credencial ${cred} debería haberse ocultado`).not.toContain(cred);
      expect(msg).not.toContain('api.example.com');
    }
  });

  it('aiErrorMessage(): error desconocido → mensaje genérico', () => {
    const err = new AIError('unknown: some internal detail with OPEN_AI_0123456789abcdef', 'AI_FAILED');
    const msg = aiErrorMessage(err);
    expect(msg).not.toContain('OPEN_AI_0123456789abcdef');
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toMatch(/IA|error/i);
  });

  it('aiErrorMessage(): non-AIError input → mensaje genérico', () => {
    const msg = aiErrorMessage('some plain string error');
    expect(msg).not.toContain('some plain string');
    expect(msg).toMatch(/IA|error/i);

    const msg2 = aiErrorMessage(new Error('plain error with sk-anthropic-ABCDEF'));
    expect(msg2).not.toContain('sk-anthropic-ABCDEF');
  });
});

// ─── Punto 5: safeApiError y sanitización ───────────────────────────────────

describe('safeApiError y sanitización — punto 5', () => {
  it('safeApiError() en producción: siempre devuelve mensaje genérico, sin credenciales', () => {
    const orig = process.env.NODE_ENV;
    (process as any).env.NODE_ENV = 'production';
    try {
      const err = new Error('FATAL: internal stack at /app/src/lib/ai/engine.ts:42, key sk-anthropic-123456');
      const msg = safeApiError(err, 500);
      expect(msg).not.toContain('sk-anthropic-123456');
      expect(msg).not.toMatch(/engine\.ts/i);
      expect(msg.length).toBeLessThan(150);
      expect(msg).toMatch(/error|Error|servicio/i);
    } finally {
      (process as any).env.NODE_ENV = orig;
    }
  });

  it('safeApiError() en producción: statusCode 400 → mensaje genérico', () => {
    const orig = process.env.NODE_ENV;
    (process as any).env.NODE_ENV = 'production';
    try {
      const msg = safeApiError(new Error('some detailed dev message with SUPA_SECRET_123'), 400);
      expect(msg).not.toContain('SUPA_SECRET_123');
      expect(msg).not.toContain('detailed dev message');
      expect(msg).toMatch(/solicitud|Solicitud|inválida/i);
    } finally {
      (process as any).env.NODE_ENV = orig;
    }
  });

  it('safeApiError() en desarrollo: sk-xxx se redacta', () => {
    const orig = process.env.NODE_ENV;
    (process as any).env.NODE_ENV = 'development';
    try {
      const err = new Error('falló con API key: sk-anthropic-abcdef123456 en https://api.example.com');
      const msg = safeApiError(err, 502);
      expect(msg).not.toContain('sk-anthropic-abcdef123456');
      expect(msg).toContain('<redacted>');
    } finally {
      (process as any).env.NODE_ENV = orig;
    }
  });

  it('safeApiError() en desarrollo: Bearer token largo se redacta', () => {
    const orig = process.env.NODE_ENV;
    (process as any).env.NODE_ENV = 'development';
    try {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluIn0.payload-signature-abcdef1234567890';
      const err = new Error('Authorization: Bearer ' + token);
      const msg = safeApiError(err, 502);
      expect(msg).not.toContain(token);
      expect(msg).toContain('<redacted>');
    } finally {
      (process as any).env.NODE_ENV = orig;
    }
  });

  it('safeApiError() en desarrollo: x-api-key se redacta', () => {
    const orig = process.env.NODE_ENV;
    (process as any).env.NODE_ENV = 'development';
    try {
      const err = new Error('x-api-key: sk-anthropic-v1-secretkey1234567890abcdef');
      const msg = safeApiError(err, 502);
      expect(msg).not.toContain('sk-anthropic-v1-secretkey1234567890abcdef');
      expect(msg).toContain('<redacted>');
    } finally {
      (process as any).env.NODE_ENV = orig;
    }
  });
});

// ─── Punto 6: AdminError (errores no-IA) ────────────────────────────────────

describe('AdminError y adminErrorResponse — punto 6', () => {
  it('adminErrorResponse(): AdminError 404 → 404 NOT_FOUND con mensaje claro', async () => {
    const err = new AdminError(404, 'NOT_FOUND', 'El usuario no existe.');
    const res = adminErrorResponse(err);
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('El usuario no existe.');
  });

  it('adminErrorResponse(): AdminError 400 VALIDATION → 400 VALIDATION', async () => {
    const err = new AdminError(400, 'VALIDATION', 'Recurso no válido.');
    const res = adminErrorResponse(err);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('AdminError no expone credenciales', async () => {
    const err = new AdminError(404, 'NOT_FOUND', 'No encontrado. Intenté con key sk-secret-1234567890abcdef');
    const res = adminErrorResponse(err);
    const body: any = await res.json();
    expect(body.error.message).not.toContain('sk-secret-1234567890abcdef');
  });

  it('adminErrorResponse(): AdminValidationError → 400 VALIDATION', async () => {
    const err = new AdminValidationError('El campo content es obligatorio', 400);
    const res = adminErrorResponse(err);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toBe('El campo content es obligatorio');
  });

  it('adminErrorResponse(): AIError con credenciales → respuesta segura (sin leak)', async () => {
    const err = new AIError(
      'provider 401: invalid api key sk-anthropic-valid00000000, body={"error":{"type":"authentication_error"}}',
      'AI_FAILED',
    );
    const res = adminErrorResponse(err);
    expect(res.status).toBe(500);
    const body: any = await res.json();
    expect(body.error.message).not.toContain('sk-anthropic-valid00000000');
    expect(body.error.message).not.toMatch(/provider/i);
    expect(body.error.message).not.toMatch(/authentication_error/i);
    expect(body.error.code).toBe('AI_FAILED');
  });

  it('adminErrorResponse(): unknown error → 500 INTERNAL', async () => {
    const err = new Error('mystery failure with GEMINI_API_KEY_01234');
    const res = adminErrorResponse(err);
    expect(res.status).toBe(500);
    const body: any = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.message).not.toContain('GEMINI_API_KEY_01234');
    expect(body.error.message).toMatch(/Error interno/i);
  });
});
