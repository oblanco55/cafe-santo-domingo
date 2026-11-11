import { NextResponse } from 'next/server';
import { parseBody, withAdmin } from '@/lib/billing/http';
import { createPack, listPacks, packInputSchema } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withAdmin(async () => ({ packs: await listPacks() }));
}

export async function POST(req: Request) {
  return withAdmin(async (admin) => {
    const body = await parseBody(req, packInputSchema);
    if (body instanceof NextResponse) return body;
    return NextResponse.json({ pack: await createPack(admin, body) }, { status: 201 });
  });
}
