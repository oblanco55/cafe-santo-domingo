import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-errors';
import { verifyWebhookSignature } from '@/lib/billing/paypal';
import { processWebhookEvent } from '@/lib/billing/service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/paypal/webhook — sin sesión. Verifica la firma con PayPal y
 * procesa el evento una sola vez (PaymentEvent). 400 si la firma no es válida.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  let valid = false;
  try {
    valid = await verifyWebhookSignature(req.headers, rawBody);
  } catch {
    valid = false;
  }
  if (!valid) return jsonError(400, 'VALIDATION', 'Firma de webhook no válida.');

  const event = JSON.parse(rawBody) as { id?: string; event_type?: string; resource?: Record<string, unknown> };
  if (!event.id || !event.event_type) return jsonError(400, 'VALIDATION', 'Evento incompleto.');
  try {
    const processed = await processWebhookEvent({ id: event.id, event_type: event.event_type, resource: event.resource });
    return NextResponse.json({ received: true, processed });
  } catch {
    // 500 → PayPal reintenta más tarde.
    return jsonError(500, 'INTERNAL', 'No se pudo procesar el evento.');
  }
}
