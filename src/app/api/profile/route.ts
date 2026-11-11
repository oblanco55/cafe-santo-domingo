import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import {
  COUNTRIES,
  OFFER_TYPES,
  SECTORS,
} from '@/lib/contracts/catalogs';

export const dynamic = 'force-dynamic';

const COUNTRY_ISO_VALUES = COUNTRIES.map((c) => c.iso);

const profileBodySchema = z.object({
  countryIso: z
    .enum(COUNTRY_ISO_VALUES, { error: 'Selecciona una opción válida' })
    .optional(),
  offerType: z
    .enum(Object.keys(OFFER_TYPES) as [string, ...string[]], {
      error: 'Selecciona una opción válida',
    })
    .optional(),
  sector: z
    .enum(Object.keys(SECTORS) as [string, ...string[]], {
      error: 'Selecciona una opción válida',
    })
    .optional(),
  sectorOther: z
    .string()
    .trim()
    .min(2, 'Si elegiste «Otro», indica el sector en al menos 2 caracteres.')
    .max(80, 'El sector libre no debe superar 80 caracteres.')
    .nullish()
    .optional(),
  description: z
    .string()
    .trim()
    .min(20, 'Describe tu producto o servicio con al menos 20 caracteres.')
    .max(1500, 'La descripción no debe superar 1500 caracteres. Sé más breve.')
    .optional(),
});

/**
 * GET /api/profile
 * Devuelve { profile: BusinessProfile | null } del usuario autenticado.
 */
export async function GET(_req: NextRequest) {
  let userId: string;
  try {
    const user = await requireUser();
    userId = user.id;
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json(e.body, { status: e.status });
    }
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const profile = await db.businessProfile.findFirst({
    where: { userId },
  });

  return NextResponse.json({ profile });
}

/**
 * PUT /api/profile
 * Actualiza el BusinessProfile del usuario autenticado.
 * Todos los campos son opcionales; el valor enviado se sobreescribe.
 */
export async function PUT(req: NextRequest) {
  let userId: string;
  try {
    const user = await requireUser();
    userId = user.id;
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json(e.body, { status: e.status });
    }
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser JSON válido.');
  }

  const parsed = profileBodySchema.safeParse(raw);
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  const { countryIso, offerType, sector, sectorOther, description } = parsed.data;

  const data: Record<string, unknown> = {};
  if (countryIso !== undefined) data.countryIso = countryIso;
  if (offerType !== undefined) data.offerType = offerType;
  if (sector !== undefined) data.sector = sector;
  if (sectorOther !== undefined) data.sectorOther = sectorOther;
  if (description !== undefined) data.description = description;

  const profile = await db.businessProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return NextResponse.json({ profile });
}
