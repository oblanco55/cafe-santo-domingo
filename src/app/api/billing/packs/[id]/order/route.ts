import { NextResponse } from 'next/server';
import { withUser } from '@/lib/billing/http';
import { createPackOrder } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** POST — crea la orden de PayPal para comprar el paquete → { orderId }. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUser(async (user) => NextResponse.json(await createPackOrder(user.id, id), { status: 201 }));
}
