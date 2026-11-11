import { NextResponse } from 'next/server';
import { parseBody, withAdmin } from '@/lib/billing/http';
import {
  billingSettingsUpdateSchema,
  getBillingSettings,
  updateBillingSettings,
} from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/** GET/PUT /api/admin/billing/settings — monetización y credenciales PayPal (secreto enmascarado). */
export async function GET() {
  return withAdmin(async () => ({ settings: await getBillingSettings() }));
}

export async function PUT(req: Request) {
  return withAdmin(async (admin) => {
    const body = await parseBody(req, billingSettingsUpdateSchema);
    if (body instanceof NextResponse) return body;
    return { settings: await updateBillingSettings(admin, body) };
  });
}
