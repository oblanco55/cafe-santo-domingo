import { NextResponse } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import { updateProvider, deleteProvider, AdminValidationError } from '@/lib/admin';
import { aiproUpdateSchema } from '@/lib/contracts/admin';
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let admin;
  let id: string;
  try {
    admin = await resolveAdmin();
    id = (await ctx.params).id;
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
  const parsed = aiproUpdateSchema.safeParse(raw);
  if (!parsed.success) return zodValidationError(parsed.error);

  const ip = extractIp(req);
  try {
    const updated = await updateProvider(admin, ip, id, parsed.data);
    return NextResponse.json({ provider: updated });
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    if (e instanceof AdminValidationError) return jsonError(e.status, 'VALIDATION', e.message);
    const status = e instanceof Error && 'status' in e ? Number((e as { status: number }).status) || 500 : 500;
    return jsonError(status, 'INTERNAL', e instanceof Error ? e.message : 'Error interno');
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let admin;
  let id: string;
  try {
    admin = await resolveAdmin();
    id = (await ctx.params).id;
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const ip = extractIp(req);
  try {
    const result = await deleteProvider(admin, ip, id);
    return NextResponse.json(result);
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    const status = e instanceof Error && 'status' in e ? Number((e as { status: number }).status) || 500 : 500;
    return jsonError(status, 'INTERNAL', e instanceof Error ? e.message : 'Error interno');
  }
}
