import { auth } from '@/auth';
import { db } from '@/lib/db';
import type { ApiError } from '@/lib/contracts';

/**
 * Devuelve el usuario autenticado actual o lanza un Error con metadatos
 * listos para convertir a una respuesta 401 (formato ApiError).
 *
 * Uso:
 *   const user = await requireUser();
 *   → { id, name, email }
 *
 * Si no hay sesión, lanza UnauthenticatedError con `toResponse()` que
 * devuelve una NextResponse 401.
 */
export class UnauthenticatedError extends Error {
  readonly status = 401;
  readonly body: ApiError = {
    error: { code: 'UNAUTHORIZED', message: 'Debes iniciar sesión para continuar.' },
  };
  constructor() {
    super('Debes iniciar sesión para continuar.');
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  readonly body: ApiError = {
    error: { code: 'FORBIDDEN', message: 'No tienes permisos para esta acción.' },
  };
  constructor() {
    super('No tienes permisos para esta acción.');
    this.name = 'ForbiddenError';
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }
  const userId = session.user.id;
  // Verificación en BD: un usuario desactivado o inexistente pierde su sesión
  // de inmediato, sin esperar la expiración del JWT. (F2-3d punto 2)
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true, name: true, email: true },
  });
  if (!row || !row.active) {
    throw new UnauthenticatedError();
  }
  return {
    id: row.id,
    name: row.name ?? session.user.name ?? null,
    email: row.email ?? session.user.email ?? null,
    role: row.role as 'user' | 'admin',
  };
}

/**
 * Requiere que el usuario actual tenga el rol 'admin'.
 * El rol usado es el de la BD (no el del token): un cambio de rol surte efecto inmediato. (F2-3d punto 2)
 * Lanza ForbiddenError (403) si no es admin.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new ForbiddenError();
  }
  return user;
}

/**
 * Perfil de negocio del usuario actual, mapeado al formulario de creación.
 * Si no hay sesión o no hay perfil, devuelve null.
 */
export async function getCreationFormProfile(): Promise<{
  countryIso: string | null;
  offerType: string | null;
  sector: string | null;
  sectorOther: string | null;
  description: string | null;
} | null> {
  try {
    const user = await requireUser();
    const { db } = await import('@/lib/db');
    const profile = await db.user.findUnique({
      where: { id: user.id },
      select: {
        businessProfile: {
          select: {
            countryIso: true,
            offerType: true,
            sector: true,
            sectorOther: true,
            description: true,
          },
        },
      },
    });
    const bp = profile?.businessProfile;
    if (!bp) return null;
    return {
      countryIso: bp.countryIso,
      offerType: bp.offerType ?? null,
      sector: bp.sector,
      sectorOther: bp.sectorOther,
      description: bp.description,
    };
  } catch {
    return null;
  }
}
