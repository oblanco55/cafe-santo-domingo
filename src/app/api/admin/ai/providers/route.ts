import { NextResponse } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import { listProviders, createProvider, AdminValidationError } from '@/lib/admin';
import { aiproCreateSchema } from '@/lib/contracts/admin';
import { extractIp, toAdmin } from '@/lib/admin-utils';

export const dynamic = 'force-dynamic';

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof UnauthenticatedError) return NextResponse.json(e.body, { status: e.status });
  if (e instanceof ForbiddenError) return NextResponse.json(e.body, { status: e.status });
  return null;
}

async function resolveAdmin() {
  return toAdmin(await requireAdmin());
}

export async function GET(_req: Request) {
  try {
    await resolveAdmin();
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  try {
    const providers = await listProviders();
    return NextResponse.json({ providers });
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    const status = e instanceof Error && 'status' in e ? Number((e as { status: number }).status) || 500 : 500;
    return jsonError(status, 'INTERNAL', e instanceof Error ? e.message : 'Error interno');
  }
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await resolveAdmin();
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
  const parsed = aiproCreateSchema.safeParse(raw);
  if (!parsed.success) return zodValidationError(parsed.error);

  const ip = extractIp(req);
  try {
    const created = await createProvider(admin, ip, parsed.data);
    return NextResponse.json({ provider: created }, { status: 201 });
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    if (e instanceof AdminValidationError) return jsonError(e.status, 'VALIDATION', e.message);
    const status = e instanceof Error && 'status' in e ? Number((e as { status: number }).status) || 500 : 500;
    return jsonError(status, 'INTERNAL', e instanceof Error ? e.message : 'Error interno');
  }
}
