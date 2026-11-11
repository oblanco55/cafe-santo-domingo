import { NextResponse } from 'next/server';
import { requireUser, UnauthenticatedError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';
import { getUsage } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

/** GET /api/billing/usage — uso del mes, créditos y suscripción del usuario (F2-7a). */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await getUsage(user.id));
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return NextResponse.json(e.body, { status: e.status });
    }
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
}
