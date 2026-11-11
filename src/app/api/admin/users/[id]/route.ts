import { NextResponse } from 'next/server';
import { requireAdmin, UnauthenticatedError, ForbiddenError } from '@/lib/session';
import { jsonError, zodValidationError } from '@/lib/api-errors';
import { updateUser } from '@/lib/admin';
import { z } from 'zod';
import { extractIp, toAdmin } from '@/lib/admin-utils';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  active: z.boolean().optional(),
}).refine((v) => v.role !== undefined || v.active !== undefined, {
  message: 'envia al menos uno de role o active',
});

function authResponse(e: unknown): NextResponse | null {
  if (e instanceof UnauthenticatedError) {
    return NextResponse.json(e.body, { status: e.status });
  }
  if (e instanceof ForbiddenError) {
    return NextResponse.json(e.body, { status: e.status });
  }
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let admin;
  try {
    admin = toAdmin(await requireAdmin());
  } catch (e) {
    const r = authResponse(e);
    if (r) return r;
    return jsonError(500, 'INTERNAL', 'Error inesperado');
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION', 'El cuerpo debe ser JSON valido.');
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  try {
    const ip = extractIp(req as unknown as { headers: { get(name: string): string | null } });
    const user = await updateUser(admin, ip, id, parsed.data);
    return NextResponse.json({ user });
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
