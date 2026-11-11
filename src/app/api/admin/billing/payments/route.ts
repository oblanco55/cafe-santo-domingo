import { withAdmin } from '@/lib/billing/http';
import { listPayments } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** GET /api/admin/billing/payments?page=&pageSize= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
  return withAdmin(async () => listPayments(page, pageSize));
}
