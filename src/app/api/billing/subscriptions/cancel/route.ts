import { withUser } from '@/lib/billing/http';
import { cancelUserSubscription } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** POST — cancela en PayPal la suscripción activa del usuario. */
export async function POST() {
  return withUser(async (user) => {
    const sub = await cancelUserSubscription(user.id);
    return { subscription: { id: sub.id, status: sub.status } };
  });
}
