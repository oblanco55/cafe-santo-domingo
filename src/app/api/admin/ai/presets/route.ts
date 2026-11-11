import { NextResponse } from 'next/server';
import { PROVIDER_PRESETS } from '@/lib/ai/presets';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json(e.body, { status: e.status });
    if (e instanceof ForbiddenError) return NextResponse.json(e.body, { status: e.status });
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
  return NextResponse.json({ presets: PROVIDER_PRESETS });
}
