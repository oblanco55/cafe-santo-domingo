import { withAdmin } from '@/lib/billing/http';
import { testPayPalConnection } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** POST /api/admin/billing/test — comprueba las credenciales pidiendo un token a PayPal. */
export async function POST() {
  return withAdmin(async () => testPayPalConnection());
}
