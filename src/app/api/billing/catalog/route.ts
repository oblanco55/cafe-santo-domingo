import { NextResponse } from 'next/server';
import { billingErrorResponse } from '@/lib/billing/http';
import { getCatalog } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** GET /api/billing/catalog (público) — planes, paquetes y datos para el JS SDK de PayPal. */
export async function GET() {
  try {
    return NextResponse.json(await getCatalog());
  } catch (e) {
    return billingErrorResponse(e);
  }
}
