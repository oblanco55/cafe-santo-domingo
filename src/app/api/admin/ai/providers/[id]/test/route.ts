import { NextResponse } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';
import { testProviderConnection } from '@/lib/admin';
import { toAdmin } from '@/lib/admin-utils';

export const dynamic = 'force-dynamic';

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof UnauthenticatedError) return NextResponse.json(e.body, { status: e.status });
  if (e instanceof ForbiddenError) return NextResponse.json(e.body, { status: e.status });
  return null;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await toAdmin(await requireAdmin());
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const { id } = await ctx.params;
  try {
    const result = await testProviderConnection(id);
    return NextResponse.json(result);
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    const status = e instanceof Error && 'status' in e ? Number((e as { status: number }).status) || 500 : 500;
    return jsonError(status, 'INTERNAL', e instanceof Error ? e.message : 'Error interno');
  }
}
