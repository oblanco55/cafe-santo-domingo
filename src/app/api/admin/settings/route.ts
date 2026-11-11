import { NextResponse } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import { getSettings, updateSettings } from '@/lib/admin';
import { settingsUpdateSchema } from '@/lib/contracts/admin';
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

export async function GET(_req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }
}

export async function PATCH(req: Request) {
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
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser JSON valido.');
  }

  const parsed = settingsUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  try {
    const ip = extractIp(req as unknown as { headers: { get(name: string): string | null } });
    const settings = await updateSettings(admin, ip, parsed.data);
    return NextResponse.json({ settings });
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
