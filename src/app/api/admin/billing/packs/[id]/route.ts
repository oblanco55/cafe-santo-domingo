import { NextResponse } from 'next/server';
import { parseBody, withAdmin } from '@/lib/billing/http';
import { deactivatePack, packUpdateSchema, updatePack } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(async (admin) => {
    const body = await parseBody(req, packUpdateSchema);
    if (body instanceof NextResponse) return body;
    return { pack: await updatePack(admin, id, body) };
  });
}

/** DELETE desactiva el paquete (los pagos históricos lo siguen referenciando). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(async (admin) => ({ pack: await deactivatePack(admin, id) }));
}
