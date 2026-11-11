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
import type { ApiError } from '@/lib/contracts';

import type * as runtime from '@prisma/client/runtime/client';
function toDbJson(value: unknown): runtime.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as runtime.InputJsonValue;
}

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['video', 'photo', 'carousel'] as const;
const TYPE_MAP: Record<string, 'video' | 'photo' | 'carousel'> = { video: 'video', photo: 'photo', carousel: 'carousel' };

function invalidTypeResponse(): NextResponse {
  const body: ApiError = {
    error: { code: 'VALIDATION', message: 'Modalidad no válida' },
  };
  return NextResponse.json(body, { status: 404 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type: rawType } = await params;
  if (!VALID_TYPES.includes(rawType as 'video')) return invalidTypeResponse();
  const type = TYPE_MAP[rawType];

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

  // Rate limit: 20 creaciones por usuario cada 10 min
  const rl = checkRateLimit(`creations:${userId}`, Date.now());
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT', 'Has alcanzado el límite temporal. Intenta en unos minutos.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser JSON válido.');
  }

  // F2-7a: derechos de creación (capa gratuita, suscripción, créditos)
  const access = await checkCanCreate({ id: userId, role });
  if (!access.allowed) {
    return jsonError(402, 'PAYMENT_REQUIRED', PAYMENT_REQUIRED_MESSAGE);
  }

  try {
    const r = await generateCreation(type, body);
    // Persistencia: success
    const creation = await db.creation.create({
      data: {
        userId,
        type,
        input: toDbJson(r.input),
        output: toDbJson(r.output),
        status: 'ok',
        model: r.model,
        billingSource: access.source,
      },
    });
    await recordCreationCharge(userId, creation.id, access.source);

    // Upsert de BusinessProfile para precargar la próxima vez
    const input = r.input as Record<string, unknown>;
    await db.businessProfile.upsert({
      where: { userId },
      create: {
        userId,
        countryIso: (input.countryIso as string | undefined) ?? null,
        offerType: (input.offerType as 'product' | 'service') ?? null,
        sector: (input.sector as string | undefined) ?? null,
        sectorOther: (input.sectorOther as string | undefined) ?? null,
        description: (input.description as string | undefined) ?? null,
      },
      update: {
        countryIso: (input.countryIso as string | undefined) ?? null,
        offerType: (input.offerType as 'product' | 'service') ?? null,
        sector: (input.sector as string | undefined) ?? null,
        sectorOther: (input.sectorOther as string | undefined) ?? null,
        description: (input.description as string | undefined) ?? null,
      },
    });

    return NextResponse.json({ id: creation.id, type, output: r.output }, { status: 201 });
  } catch (e) {
    if (e instanceof AIError) {
      if (e.code === 'VALIDATION') {
        // NO se guarda: error de validación
        return NextResponse.json(
          { error: { code: 'VALIDATION', message: e.message, fieldErrors: e.fieldErrors } },
          { status: 400 },
        );
      }

      // AI_FAILED, CONFIG, RATE_LIMIT → guardar con status error
      await db.creation.create({
        data: {
          userId,
          type,
          input: toDbJson(body),
          output: toDbJson(null),
          status: 'error',
          errorMessage: e.message,
        },
      });

      if (e.code === 'RATE_LIMIT') {
        return jsonError(429, 'RATE_LIMIT', e.message);
      }
      // AI_FAILED o CONFIG
      return jsonError(502, 'AI_FAILED', e.message);
    }

    // Otro error no previsto
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
}
