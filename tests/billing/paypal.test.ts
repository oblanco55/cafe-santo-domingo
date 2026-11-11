/**
 * F2-7b — Integración PayPal con fetch simulado y BD en memoria.
 * Cubre: token en caché, captura idempotente, confirmación de suscripción
 * con plan_id distinto, webhook con firma inválida, eventos repetidos y
 * que el secreto nunca aparezca en las respuestas.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

type Row = Record<string, any>;
const t = {
  settings: new Map<string, unknown>(),
  payments: [] as Row[],
  ledger: [] as Row[],
  plans: [] as Row[],
  packs: [] as Row[],
  subs: [] as Row[],
  events: new Map<string, Row>(),
};
let seq = 0;
const id = () => `id${++seq}`;
const pick = (rows: Row[], where: Row) =>
  rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;

vi.mock('@/lib/db', () => {
  const db: Row = {
    appSetting: {
      findMany: vi.fn(async ({ where }: Row) =>
        [...t.settings].filter(([k]) => where.key.in.includes(k)).map(([key, value]) => ({ key, value })),
      ),
      upsert: vi.fn(async ({ where, create }: Row) => {
        t.settings.set(where.key, create.value);
        return create;
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    adminAuditLog: { create: vi.fn(async () => ({})) },
    creditPack: { findFirst: vi.fn(async ({ where }: Row) => pick(t.packs, where)) },
    plan: { findUnique: vi.fn(async ({ where }: Row) => pick(t.plans, where)) },
    payment: {
      findUnique: vi.fn(async ({ where }: Row) => pick(t.payments, where)),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: id(), ...data };
        t.payments.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: Row) => Object.assign(pick(t.payments, where)!, data)),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const row = t.payments.find((p) => p.id === where.id && p.status !== where.status.not);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      }),
    },
    creditLedger: {
      create: vi.fn(async ({ data }: Row) => {
        t.ledger.push(data);
        return data;
      }),
    },
    subscription: {
      findUnique: vi.fn(async ({ where }: Row) => pick(t.subs, where)),
      upsert: vi.fn(async ({ where, create, update }: Row) => {
        const row = pick(t.subs, where);
        if (row) return Object.assign(row, update);
        const n = { id: id(), ...create };
        t.subs.push(n);
        return n;
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const rows = t.subs.filter((s) => s.paypalSubscriptionId === where.paypalSubscriptionId);
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
    },
    paymentEvent: {
      create: vi.fn(async ({ data }: Row) => {
        if (t.events.has(data.id)) throw new Error('Unique constraint');
        t.events.set(data.id, data);
        return data;
      }),
      delete: vi.fn(async ({ where }: Row) => t.events.delete(where.id)),
    },
  };
  return { db };
});

vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = (await importOriginal<typeof import('@/lib/session')>()) as Row;
  return {
    ...mod,
    requireAdmin: vi.fn(async () => ({ id: 'admin1', name: 'Admin', email: 'a@example.test', role: 'admin' })),
    requireUser: vi.fn(async () => ({ id: 'u1', name: 'U', email: 'u@example.test', role: 'user' })),
  };
});

import { clearPayPalTokenCache, getAccessToken } from '@/lib/billing/paypal';
import { clearMonetizationSettingsCache } from '@/lib/billing/settings';
import { capturePackOrder, confirmSubscription, processWebhookEvent } from '@/lib/billing/service';
import { GET as getSettings, PUT as putSettings } from '@/app/api/admin/billing/settings/route';
import { POST as webhook } from '@/app/api/paypal/webhook/route';

const SECRET = 'EPsecretoDePruebaSandbox1234567890WXYZ';

type Handler = (url: string, init: RequestInit) => { status?: number; body?: unknown };
let handler: Handler;
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const r = handler(String(url), init ?? {});
  return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), {
    status: r.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
});
vi.stubGlobal('fetch', fetchMock);

/** Respuestas por defecto: token OK y el resto definido por cada test. */
function paypal(routes: Record<string, Handler>) {
  handler = (url, init) => {
    if (url.endsWith('/v1/oauth2/token')) return { body: { access_token: 'tok', expires_in: 3600 } };
    for (const [suffix, h] of Object.entries(routes)) if (url.includes(suffix)) return h(url, init);
    return { status: 404, body: { name: 'NOT_FOUND', message: url } };
  };
}

async function configure() {
  const res = await putSettings(
    new Request('http://x/api/admin/billing/settings', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: true,
        paypal: { mode: 'sandbox', clientId: 'client-abc', clientSecret: SECRET, webhookId: 'WH-1' },
      }),
    }),
  );
  expect(res.status).toBe(200);
  return res;
}

beforeEach(async () => {
  t.settings.clear();
  t.payments = [];
  t.ledger = [];
  t.plans = [];
  t.packs = [];
  t.subs = [];
  t.events.clear();
  fetchMock.mockClear();
  clearPayPalTokenCache();
  clearMonetizationSettingsCache();
  paypal({});
  await configure();
});

describe('cliente PayPal', () => {
  it('reutiliza el token en caché', async () => {
    await getAccessToken();
    await getAccessToken();
    const tokenCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/v1/oauth2/token'));
    expect(tokenCalls).toHaveLength(1);
    expect(String(tokenCalls[0][0])).toContain('api-m.sandbox.paypal.com');
  });
});

describe('ajustes de monetización', () => {
  it('el secreto nunca aparece en las respuestas (solo enmascarado)', async () => {
    const put = await (await configure()).text();
    const get = await (await getSettings()).text();
    for (const body of [put, get]) {
      expect(body).not.toContain(SECRET);
      expect(body).toContain('••••WXYZ');
    }
    // Se guarda cifrado, nunca en claro.
    expect(String(t.settings.get('paypal.clientSecretEnc'))).not.toContain(SECRET);
  });
});

describe('compra de paquetes', () => {
  it('la captura acredita una sola vez aunque se llame dos veces', async () => {
    t.payments.push({
      id: 'p1', userId: 'u1', kind: 'credit_pack', paypalOrderId: 'ORDER1', amountCents: 500,
      currency: 'USD', status: 'created', raw: { packId: 'k1', credits: 10 },
    });
    paypal({
      '/v2/checkout/orders/ORDER1/capture': () => ({
        body: {
          id: 'ORDER1', status: 'COMPLETED',
          purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { value: '5.00', currency_code: 'USD' } }] } }],
        },
      }),
    });
    const a = await capturePackOrder('u1', 'ORDER1');
    const b = await capturePackOrder('u1', 'ORDER1');
    expect(a).toMatchObject({ status: 'COMPLETED', credits: 10, alreadyProcessed: false });
    expect(b.alreadyProcessed).toBe(true);
    expect(t.ledger).toEqual([{ userId: 'u1', delta: 10, reason: 'purchase', refType: 'payment', refId: 'p1' }]);
  });

  it('no deja capturar la orden de otro usuario', async () => {
    t.payments.push({ id: 'p2', userId: 'otro', paypalOrderId: 'ORDER2', status: 'created', raw: {} });
    await expect(capturePackOrder('u1', 'ORDER2')).rejects.toMatchObject({ status: 404 });
  });
});

describe('suscripciones', () => {
  it('rechaza una suscripción cuyo plan_id no coincide', async () => {
    t.plans.push({ id: 'plan1', paypalPlanId: 'P-OK', priceCents: 900, currency: 'USD' });
    paypal({
      '/v1/billing/subscriptions/I-SUB': () => ({ body: { id: 'I-SUB', status: 'ACTIVE', plan_id: 'P-OTRO' } }),
    });
    await expect(
      confirmSubscription('u1', { subscriptionId: 'I-SUB', planId: 'plan1' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(t.subs).toHaveLength(0);
  });

  it('guarda la suscripción activa con su periodo', async () => {
    t.plans.push({ id: 'plan1', paypalPlanId: 'P-OK', priceCents: 900, currency: 'USD' });
    paypal({
      '/v1/billing/subscriptions/I-SUB': () => ({
        body: {
          id: 'I-SUB', status: 'ACTIVE', plan_id: 'P-OK', custom_id: 'u1',
          billing_info: { next_billing_time: '2030-01-01T00:00:00Z' },
        },
      }),
    });
    await confirmSubscription('u1', { subscriptionId: 'I-SUB', planId: 'plan1' });
    expect(t.subs[0]).toMatchObject({ userId: 'u1', status: 'ACTIVE', paypalSubscriptionId: 'I-SUB' });
    expect(t.subs[0].currentPeriodEnd.toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });
});

describe('webhook', () => {
  const headers = {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
    'paypal-transmission-id': 'tx1',
    'paypal-transmission-sig': 'sig',
    'paypal-transmission-time': '2026-10-23T00:00:00Z',
  };
  const event = { id: 'WH-EVT-1', event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-SUB' } };

  it('firma inválida → 400 y no procesa nada', async () => {
    t.subs.push({ id: 's1', paypalSubscriptionId: 'I-SUB', status: 'ACTIVE' });
    paypal({ 'verify-webhook-signature': () => ({ body: { verification_status: 'FAILURE' } }) });
    const res = await webhook(new Request('http://x/api/paypal/webhook', { method: 'POST', headers, body: JSON.stringify(event) }));
    expect(res.status).toBe(400);
    expect(t.subs[0].status).toBe('ACTIVE');
  });

  it('sin cabeceras de firma → 400', async () => {
    const res = await webhook(new Request('http://x/api/paypal/webhook', { method: 'POST', body: JSON.stringify(event) }));
    expect(res.status).toBe(400);
  });

  it('firma válida actualiza el estado y un evento repetido no se procesa dos veces', async () => {
    t.subs.push({ id: 's1', paypalSubscriptionId: 'I-SUB', status: 'ACTIVE' });
    paypal({ 'verify-webhook-signature': () => ({ body: { verification_status: 'SUCCESS' } }) });
    const send = () =>
      webhook(new Request('http://x/api/paypal/webhook', { method: 'POST', headers, body: JSON.stringify(event) }));
    const first = await (await send()).json();
    expect(first).toEqual({ received: true, processed: true });
    expect(t.subs[0].status).toBe('CANCELLED');
    t.subs[0].status = 'ACTIVE';
    const second = await (await send()).json();
    expect(second).toEqual({ received: true, processed: false });
    expect(t.subs[0].status).toBe('ACTIVE');
  });

  it('un reembolso resta los créditos del paquete una sola vez', async () => {
    t.payments.push({
      id: 'p9', userId: 'u1', kind: 'credit_pack', paypalCaptureId: 'CAP9', status: 'completed',
      raw: { credits: 5 },
    });
    const refund = {
      id: 'WH-REF', event_type: 'PAYMENT.CAPTURE.REFUNDED',
      resource: { id: 'R1', links: [{ rel: 'up', href: 'https://api.sandbox.paypal.com/v2/payments/captures/CAP9' }] },
    };
    expect(await processWebhookEvent(refund)).toBe(true);
    expect(await processWebhookEvent(refund)).toBe(false);
    expect(t.payments[0].status).toBe('refunded');
    expect(t.ledger).toEqual([{ userId: 'u1', delta: -5, reason: 'refund', refType: 'payment', refId: 'p9' }]);
  });
});
