import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';
import { generateCreation, AIError } from '@/lib/ai/engine';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  checkCanCreate,
  PAYMENT_REQUIRED_MESSAGE,
  recordCreationCharge,
} from '@/lib/billing/entitlements';
import type { CreationResult } from '@/lib/ai/engine';

import type * as runtime from '@prisma/client/runtime/client';
function toDbJson(value: unknown): runtime.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as runtime.InputJsonValue;
}

export const dynamic = 'force-dynamic';

/**
 * POST /api/creations/item/[id]/regenerate
 *
 * Regenera una creación propia no oculta usando SU input original:
 *   1. requireUser → 401 si no hay sesión.
 *   2. Busca la creación (id, userId, hiddenAt null) → 404 si no existe,
 *      es de otro, o está oculta.
 *   3. checkRateLimit → 429 si se alcanza el límite temporal.
 *   4. checkCanCreate → 402 PAYMENT_REQUIRED si no hay derecho.
 *   5. generateCreation(type, input) → lanza si falla.
 *   6. Guarda la nueva Creation con parentId = id y el billingSource
 *      de la comprobación 4, status ok.
 *   7. recordCreationCharge (solo si source == 'credit').
 *
 * AIError → mismo comportamiento que POST normal:
 *   - VALIDATION → 400 con fieldErrors, NO se guarda
 *   - AI_FAILED/RATE_LIMIT/CONFIG → se guarda status error, responde
 *     429 (RATE_LIMIT) o 502 (el resto)
 *   No consume derecho ni genera cargo.
 *
 * Respuesta 201: { id, type, output } — la nueva creación hija.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string;
  let role: string | undefined;
  try {
    const user = await requireUser();
    userId = user.id;
    role = user.role;
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json(e.body, { status: e.status });
    }
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const { id } = await params;

  const creation = await db.creation.findFirst({
    where: { id, userId, hiddenAt: null },
  });
  if (!creation) {
    return jsonError(404, 'VALIDATION', 'Creación no encontrada.');
  }

  const rl = checkRateLimit(`creations:${userId}`, Date.now());
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT', 'Has alcanzado el límite temporal. Intenta en unos minutos.');
  }

  // F2-7a: derechos de creación (capa gratuita, suscripción, créditos)
  const access = await checkCanCreate({ id: userId, role });
  if (!access.allowed) {
    return jsonError(402, 'PAYMENT_REQUIRED', PAYMENT_REQUIRED_MESSAGE);
  }

  let r: CreationResult;
  try {
    r = await generateCreation(creation.type, creation.input);
  } catch (e) {
    if (e instanceof AIError) {
      if (e.code === 'VALIDATION') {
        return NextResponse.json(
          { error: { code: 'VALIDATION', message: e.message, fieldErrors: e.fieldErrors } },
          { status: 400 },
        );
      }
      // AI_FAILED, CONFIG, RATE_LIMIT → guardar con status error (input = el guardado)
      await db.creation.create({
        data: {
          userId,
          type: creation.type,
          input: toDbJson(creation.input),
          output: toDbJson(null),
          status: 'error',
          errorMessage: e.message,
          parentId: creation.id,
        },
      });
      if (e.code === 'RATE_LIMIT') {
        return jsonError(429, 'RATE_LIMIT', e.message);
      }
      return jsonError(502, 'AI_FAILED', e.message);
    }
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  let child: { id: string };
  try {
    child = await db.creation.create({
      data: {
        userId,
        type: creation.type,
        input: toDbJson(r.input),
        output: toDbJson(r.output),
        status: 'ok',
        model: r.model,
        billingSource: access.source,
        parentId: creation.id,
      },
    });
    await recordCreationCharge(userId, child.id, access.source);
  } catch {
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  return NextResponse.json(
    {
      id: child.id,
      type: creation.type,
      output: r.output,
    },
    { status: 201 },
  );
}
