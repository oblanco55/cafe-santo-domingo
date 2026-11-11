import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import { listLegalDocuments, upsertLegalDocument } from '@/lib/admin';
import { LEGAL_SLUGS, isLegalSlug, legalContentSchema, legalTitleSchema } from '@/lib/contracts/admin';
import { extractIp, toAdmin } from '@/lib/admin-utils';

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

export async function GET(_req: NextRequest) {
  let admin;
  try {
    admin = toAdmin(await requireAdmin());
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
  try {
    const docs = await listLegalDocuments();
    return NextResponse.json({ documents: docs });
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = toAdmin(await requireAdmin());
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser JSON válido.');
  }

  const body = raw as Record<string, unknown>;
  const slugRaw = body.slug;
  if (typeof slugRaw === 'string' && isLegalSlug(slugRaw)) {
    const contentParsed = legalContentSchema.safeParse(body.content);
    if (!contentParsed.success) {
      return zodValidationError(contentParsed.error);
    }
    const titleParsed = legalTitleSchema.safeParse(body.title ?? '');
    if (!titleParsed.success) {
      return zodValidationError(titleParsed.error);
    }

    const ip = extractIp(req);
    try {
      const doc = await upsertLegalDocument(admin, ip, slugRaw, {
        content: contentParsed.data,
        title: titleParsed.data,
      });
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

  return jsonError(400, 'VALIDATION', `El slug debe ser uno de: ${LEGAL_SLUGS.join(', ')}.`);
}
