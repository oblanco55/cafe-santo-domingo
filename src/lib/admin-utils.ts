import { jsonError } from '@/lib/api-errors';
import { AIError } from '@/lib/ai/errors';
import { aiErrorMessage, safeApiError } from '@/lib/utils';
import { AdminError } from '@/lib/admin-errors';
import type { ApiErrorCode } from '@/lib/contracts';
import type { Admin } from '@/lib/audit';

export class AdminValidationError extends Error {
  constructor(
    public readonly message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AdminValidationError';
  }
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminError) {
    const code = (['NOT_FOUND', 'VALIDATION', 'AI_FAILED'].includes(error.code) ? error.code : 'VALIDATION') as ApiErrorCode;
    return jsonError(error.status, code, safeApiError(error, error.status));
  }
  if (error instanceof AIError) {
    const code: ApiErrorCode = error.code === 'AI_FAILED' ? 'AI_FAILED' : 'INTERNAL';
    const safeMsg = aiErrorMessage(error) ?? 'Error interno del servicio de administración.';
    return jsonError(500, code, safeMsg, (error.fieldErrors as Record<string, string[]> | undefined));
  }
  if (error instanceof AdminValidationError) {
    return jsonError(error.status, 'VALIDATION', error.message ?? 'Datos de entrada inválidos.');
  }
  return jsonError(500, 'INTERNAL', 'Error interno del servicio de administración.');
}

export function extractIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const last = fwd.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
    if (last) return last;
  }
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

type SessionUser = { id: string; name?: string | null; email?: string | null };

export function toAdmin(user: SessionUser): Admin {
  return { id: user.id, name: user.name ?? null, email: user.email ?? null };
}
