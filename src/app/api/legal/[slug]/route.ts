import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-errors';
import { getLegalDocument } from '@/lib/admin';
import { isLegalSlug } from '@/lib/contracts/admin';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isLegalSlug(slug)) {
    return jsonError(404, 'VALIDATION', 'Documento no encontrado.');
  }

  try {
    const doc = await getLegalDocument(slug);
    return NextResponse.json({
      title: doc.title,
      content: doc.content,
      version: doc.version,
      updatedAt: doc.updatedAt,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      const status = Number((e as { status: number }).status) || 404;
      return jsonError(status, status === 404 ? 'VALIDATION' : 'INTERNAL', e.message || 'Documento no encontrado.');
    }
    return jsonError(404, 'VALIDATION', 'Documento no encontrado.');
  }
}
