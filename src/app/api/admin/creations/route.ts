import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';
import { listCreations } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const qSchema = z.string().max(120, 'La búsqueda no debe superar 120 caracteres').default('');
const typeSchema = z.string().max(32, 'tipo demasiado largo').default('');

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof UnauthenticatedError) {
    return NextResponse.json(e.body, { status: e.status });
  }
  if (e instanceof ForbiddenError) {
    return NextResponse.json(e.body, { status: e.status });
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? '20') || 20));
  const q = qSchema.safeParse(url.searchParams.get('q') ?? '').data;
  const type = typeSchema.safeParse(url.searchParams.get('type') ?? '').data;
  const status = url.searchParams.get('status') ?? '';
  const userId = url.searchParams.get('userId') ?? '';
  const platform = url.searchParams.get('platform') ?? '';

  try {
    const result = await listCreations({
      type: type || undefined,
      status: status || undefined,
      userId: userId || undefined,
      platform: platform || undefined,
      q: q || undefined,
      page,
      pageSize,
    });
    return NextResponse.json(result);
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
}
