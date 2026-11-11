import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creations/item/[id]
 *
 * Devuelve { id, type, input, output, status, createdAt, parentId }
 * solo si la creación pertenece al usuario autenticado.
 * Si no existe, no es del usuario o está oculta (hiddenAt != null) → 404.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  const creation = await db.creation.findFirst({
    where: { id, userId, hiddenAt: null },
  });

  if (!creation || creation.hiddenAt !== null) {
    return jsonError(404, 'VALIDATION', 'Creación no encontrada.');
  }

  return NextResponse.json({
    id: creation.id,
    type: creation.type,
    input: creation.input,
    output: creation.output,
    status: creation.status,
    createdAt: creation.createdAt,
    parentId: creation.parentId ?? null,
  });
}

/**
 * DELETE /api/creations/item/[id]
 *
 * Si la creación existe y pertenece al usuario autenticado → marca
 * hiddenAt = ahora (soft delete), responde 200 { ok: true }.
 * Si no existe o no es del usuario → 404.
 *
 * No se elimina físicamente: permite restaurar o auditar en el futuro.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  const creation = await db.creation.findFirst({
    where: { id, userId },
  });

  if (!creation) {
    return jsonError(404, 'VALIDATION', 'Creación no encontrada.');
  }

  try {
    await db.creation.update({
      where: { id },
      data: { hiddenAt: new Date() },
    });
  } catch {
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const ok: { ok: boolean } = { ok: true };
  return NextResponse.json(ok);
}

