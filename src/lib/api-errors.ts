import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import type { ApiError, ApiErrorCode } from '@/lib/contracts';

/**
 * Respuestas JSON estandarizadas formato ApiError (src/lib/contracts/api.ts).
 */
export function jsonError(status: number, code: ApiErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
  const body: ApiError = {
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
  };
  return NextResponse.json(body, { status, headers: { 'content-type': 'application/json' } });
}

export function zodToFieldErrors(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function zodValidationError(err: ZodError, message = 'Revisa los datos que enviaste.') {
  return jsonError(400, 'VALIDATION', message, zodToFieldErrors(err));
}
