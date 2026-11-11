import { NextResponse } from 'next/server';
import { parseBody, withAdmin } from '@/lib/billing/http';
import { deactivatePlan, planUpdateSchema, updatePlan } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(async (admin) => {
    const body = await parseBody(req, planUpdateSchema);
    if (body instanceof NextResponse) return body;
    return { plan: await updatePlan(admin, id, body) };
  });
}

/** DELETE desactiva el plan (las suscripciones existentes se conservan). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(async (admin) => ({ plan: await deactivatePlan(admin, id) }));
}
