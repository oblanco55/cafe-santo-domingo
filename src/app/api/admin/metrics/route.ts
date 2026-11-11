import { NextResponse } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';
import { getMetrics } from '@/lib/admin';

export const dynamic = 'force-dynamic';

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof UnauthenticatedError) {
    return NextResponse.json(e.body, { status: e.status });
  }
  if (e instanceof ForbiddenError) {
    return NextResponse.json(e.body, { status: e.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const url = new URL(req.url);
  const daysRaw = url.searchParams.get('days') ?? '30';
  const days = Math.max(1, Math.min(365, Number(daysRaw) || 30));

  try {
    const metrics = await getMetrics(days);
    return NextResponse.json({ metrics });
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
}
