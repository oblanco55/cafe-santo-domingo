import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/api-errors';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const BCRYPT_COST = 10;

function isCampaignActive(): boolean {
  const endDateStr = process.env.CAMPAIGN_END_DATE;
  if (!endDateStr) return true;
  const endDate = new Date(endDateStr);
  return Number.isNaN(endDate.getTime()) || new Date() <= endDate;
}

export async function POST(req: NextRequest) {
  // Verificar si la campaña sigue activa
  if (!isCampaignActive()) {
    return jsonError(403, 'CAMPAIGN_ENDED', 'La campaña promocional de Café Santo Domingo ha finalizado.');
  }

  // Rate limit
  const rl = checkRateLimit(rateLimitKey(req.headers, 'campaign_register'));
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT', 'Demasiados intentos. Inténtalo en unos minutos.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser un JSON válido.');
  }

  const {
    name,
    email: rawEmail,
    phone,
    favoriteProduct,
    marketingOptIn = true,
    acceptTerms,
  } = (body as Record<string, unknown>) ?? {};

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const cleanProduct = typeof favoriteProduct === 'string' ? favoriteProduct.trim() : 'Café Santo Domingo Tradicional';

  if (!cleanName || cleanName.length < 2) {
    return jsonError(400, 'VALIDATION', 'Por favor ingresa tu nombre completo.');
  }

  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return jsonError(400, 'VALIDATION', 'Por favor ingresa un correo electrónico válido.');
  }

  if (!cleanPhone || cleanPhone.length < 7) {
    return jsonError(400, 'VALIDATION', 'Por favor ingresa un número de teléfono o WhatsApp válido.');
  }

  if (acceptTerms !== true) {
    return jsonError(400, 'VALIDATION', 'Debes aceptar los términos y condiciones para participar.');
  }

  // Clave temporal para inicio de sesión inmediato y transparente
  const tempPassword = `csd_${crypto.randomBytes(16).toString('hex')}`;
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaClient = db as any;

  let user = await prismaClient.user.findUnique({
    where: { email: cleanEmail },
  });

  if (user) {
    // Actualizar usuario existente y su contraseña temporal
    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        name: cleanName,
        passwordHash,
      },
    });

    // Upsert CustomerLead
    await prismaClient.customerLead.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        phone: cleanPhone,
        favoriteProduct: cleanProduct,
        marketingOptIn: Boolean(marketingOptIn),
      },
      update: {
        phone: cleanPhone,
        favoriteProduct: cleanProduct,
        marketingOptIn: Boolean(marketingOptIn),
      },
    });
  } else {
    // Crear nuevo usuario y su CustomerLead
    user = await prismaClient.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        termsAcceptedAt: new Date(),
        role: 'user',
        customerLead: {
          create: {
            phone: cleanPhone,
            favoriteProduct: cleanProduct,
            marketingOptIn: Boolean(marketingOptIn),
          },
        },
      },
    });
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    email: cleanEmail,
    tempPassword,
    favoriteProduct: cleanProduct,
  });
}
