import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAvatarProvider, buildMockAvatarOutput } from '@/lib/ai';

export const dynamic = 'force-dynamic';

function isCampaignActive(): boolean {
  const endDateStr = process.env.CAMPAIGN_END_DATE;
  if (!endDateStr) return true;
  const endDate = new Date(endDateStr);
  return Number.isNaN(endDate.getTime()) || new Date() <= endDate;
}

export async function POST(req: NextRequest) {
  if (!isCampaignActive()) {
    return jsonError(403, 'CAMPAIGN_ENDED', 'La campaña promocional de Café Santo Domingo ha finalizado.');
  }

  const session = await auth();
  const userId = session?.user?.id;
  const userName = session?.user?.name || 'Embajador Santo Domingo';

  if (!userId) {
    return jsonError(401, 'UNAUTHENTICATED', 'Debes registrar tus datos antes de generar tu avatar.');
  }

  // Rate limit
  const rl = checkRateLimit(`campaign_gen:${userId}`, Date.now());
  if (!rl.allowed) {
    return jsonError(429, 'RATE_LIMIT', 'Por favor espera unos segundos antes de generar otro avatar.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaClient = db as any;

  // Límite de creaciones por usuario en la campaña (default: 3 avatares por persona)
  const userCreationCount = await prismaClient.creation.count({
    where: { userId },
  });

  if (userCreationCount >= 5) {
    return jsonError(
      429,
      'LIMIT_REACHED',
      'Has alcanzado el límite máximo de avatares creados para esta campaña. ¡Gracias por participar!',
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser un JSON válido.');
  }

  const {
    selfie,
    templateStyle = 'barista',
    format = 'avatar',
    favoriteProduct = 'Café Santo Domingo Tradicional',
  } = (body as Record<string, unknown>) ?? {};

  const cleanTemplate = ['barista', 'colonial', 'plantacion'].includes(templateStyle as string)
    ? (templateStyle as 'barista' | 'colonial' | 'plantacion')
    : 'barista';

  const cleanFormat = format === 'video' ? 'video' : 'avatar';
  const cleanProduct = typeof favoriteProduct === 'string' ? favoriteProduct : 'Café Santo Domingo Tradicional';

  let result: {
    imageUrl: string;
    videoUrl?: string;
    caption: string;
    model: string;
    title?: string;
    favoriteProduct?: string;
    userName?: string;
  };

  const avatarProvider = getAvatarProvider();

  try {
    if (avatarProvider.kind === 'fal' && avatarProvider.fal) {
      const falRes = await avatarProvider.fal.generateAvatar({
        selfieUrlOrBase64: typeof selfie === 'string' ? selfie : '',
        templateStyle: cleanTemplate,
        format: cleanFormat,
        favoriteProduct: cleanProduct,
        userName,
      });
      result = {
        ...falRes,
        title: `Avatar Oficial de ${userName}`,
        favoriteProduct: cleanProduct,
        userName,
      };
    } else if (avatarProvider.kind === 'replicate' && avatarProvider.replicate) {
      const repRes = await avatarProvider.replicate.generateAvatar({
        selfieUrlOrBase64: typeof selfie === 'string' ? selfie : '',
        templateStyle: cleanTemplate,
        format: cleanFormat,
        favoriteProduct: cleanProduct,
        userName,
      });
      result = {
        ...repRes,
        title: `Avatar Oficial de ${userName}`,
        favoriteProduct: cleanProduct,
        userName,
      };
    } else {
      // Mock provider
      const mockRes = buildMockAvatarOutput({
        userName,
        favoriteProduct: cleanProduct,
        templateStyle: cleanTemplate,
        selfie: typeof selfie === 'string' ? selfie : '',
        format: cleanFormat,
      });
      result = mockRes;
    }
  } catch (err) {
    // Si la API externa falla (falta de crédito, timeout, etc.), fallback transparente a Mock
    console.error('Error generando con proveedor IA, usando fallback mock:', err);
    result = buildMockAvatarOutput({
      userName,
      favoriteProduct: cleanProduct,
      templateStyle: cleanTemplate,
      selfie: typeof selfie === 'string' ? selfie : '',
      format: cleanFormat,
    });
  }

  // Guardar en la base de datos de Creaciones
  const creation = await prismaClient.creation.create({
    data: {
      userId,
      type: cleanFormat === 'video' ? 'video' : 'avatar',
      input: {
        templateStyle: cleanTemplate,
        format: cleanFormat,
        favoriteProduct: cleanProduct,
      },
      output: result,
      status: 'ok',
      model: result.model,
    },
  });

  return NextResponse.json({
    ok: true,
    creationId: creation.id,
    result,
    remainingCreations: Math.max(0, 4 - userCreationCount),
  });
}
