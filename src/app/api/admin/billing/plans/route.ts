import { NextResponse } from 'next/server';
import { parseBody, withAdmin } from '@/lib/billing/http';
import { createPlan, listPlans, planInputSchema } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withAdmin(async () => ({ plans: await listPlans() }));
}

export async function POST(req: Request) {
  return withAdmin(async (admin) => {
    const body = await parseBody(req, planInputSchema);
    if (body instanceof NextResponse) return body;
    return NextResponse.json({ plan: await createPlan(admin, body) }, { status: 201 });
  });
}
