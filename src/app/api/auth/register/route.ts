import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { registerSchema } from '@/lib/contracts';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { resolveRegisterRole } from '@/lib/admin-emails';

const BCRYPT_COST = 12;

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register
 *
 * - Valida con registerSchema (zod).
 * - Email único: 409 con "Ya existe una cuenta con este correo".
 * - Hash bcrypt costo 12; guarda termsAcceptedAt.
 * - 201 sin datos sensibles (solo { ok: true }).
 * - Rate limit simple por IP: 10 intentos / 10 min.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(rateLimitKey(req.headers, 'register'));
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT', 'Demasiados intentos. Vuelve a intentarlo en unos minutos.');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser JSON válido.');
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }
  const { name, email, password, acceptTerms } = parsed.data;
  void acceptTerms; // ya validado como literal true

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return jsonError(409, 'VALIDATION', 'Ya existe una cuenta con este correo');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const role = resolveRegisterRole(email);
  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      termsAcceptedAt: new Date(),
      role,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
