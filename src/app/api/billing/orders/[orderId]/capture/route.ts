import { withUser } from '@/lib/billing/http';
import { capturePackOrder } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** POST — captura la orden aprobada y acredita los créditos (idempotente). */
export async function POST(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withUser(async (user) => capturePackOrder(user.id, orderId));
}
