/**
 * Envoltorios de las rutas de monetización (F2-7b): autenticación y
 * traducción de errores a ApiError. Nunca exponen secretos ni trazas.
 */
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import {
  ForbiddenError,
  UnauthenticatedError,
  requireAdmin,
  requireUser,
} from '@/lib/session';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import { toAdmin } from '@/lib/admin-utils';
import type { Admin } from '@/lib/audit';
import { PayPalError } from './paypal';
import { BillingError } from './service';

type SessionUser = Awaited<ReturnType<typeof requireUser>>;

export function billingErrorResponse(e: unknown): NextResponse {
  if (e instanceof UnauthenticatedError || e instanceof ForbiddenError) {
    return NextResponse.json(e.body, { status: e.status });
  }
  if (e instanceof BillingError) {
    const code = e.status === 402 ? 'PAYMENT_REQUIRED' : e.status === 403 ? 'FORBIDDEN' : e.status >= 500 ? 'INTERNAL' : 'VALIDATION';
    return jsonError(e.status, code, e.message);
  }
  if (e instanceof PayPalError) {
    return jsonError(e.status, e.status >= 500 ? 'INTERNAL' : 'VALIDATION', e.message);
  }
  return jsonError(500, 'INTERNAL', 'Error inesperado');
}

export async function withUser(fn: (user: SessionUser) => Promise<unknown>): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const out = await fn(user);
    return out instanceof NextResponse ? out : NextResponse.json(out);
  } catch (e) {
    return billingErrorResponse(e);
  }
}

export async function withAdmin(fn: (admin: Admin) => Promise<unknown>): Promise<NextResponse> {
  try {
    const admin = toAdmin(await requireAdmin());
    const out = await fn(admin);
    return out instanceof NextResponse ? out : NextResponse.json(out);
  } catch (e) {
    return billingErrorResponse(e);
  }
}

/** Lee y valida el cuerpo JSON; devuelve los datos o una respuesta 400. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser JSON válido.');
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : zodValidationError(parsed.error);
}
