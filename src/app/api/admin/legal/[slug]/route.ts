import { NextResponse } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError } from '@/lib/api-errors';
import { getLegalDocument } from '@/lib/admin';

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin();
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const { slug } = await params;
  try {
    const doc = await getLegalDocument(slug);
    return NextResponse.json({ document: doc });
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    const status = e instanceof Error && 'status' in e ? Number((e as { status: number }).status) || 500 : 500;
    return jsonError(
      status,
      'INTERNAL',
      e instanceof Error && e.message ? e.message : 'Error interno',
    );
  }
}
