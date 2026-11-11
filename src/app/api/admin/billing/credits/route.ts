import { NextResponse } from 'next/server';
import { parseBody, withAdmin } from '@/lib/billing/http';
import { adjustCredits, creditAdjustSchema } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** POST /api/admin/billing/credits { userId, delta, note } — ajuste manual de créditos. */
export async function POST(req: Request) {
  return withAdmin(async (admin) => {
    const body = await parseBody(req, creditAdjustSchema);
    if (body instanceof NextResponse) return body;
    return NextResponse.json({ entry: await adjustCredits(admin, body) }, { status: 201 });
  });
}
