import { NextResponse } from 'next/server';
import { parseBody, withUser } from '@/lib/billing/http';
import { confirmSubscription, confirmSubscriptionSchema } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** POST { subscriptionId, planId } — verifica en PayPal y guarda la suscripción. */
export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = await parseBody(req, confirmSubscriptionSchema);
    if (body instanceof NextResponse) return body;
    const sub = await confirmSubscription(user.id, body);
    return { subscription: { id: sub.id, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } };
  });
}
