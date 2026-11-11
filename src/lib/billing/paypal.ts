/**
 * Cliente PayPal REST (ORDEN F2-7b) con fetch nativo, sin SDK de servidor.
 * Configuración en AppSetting: paypal.mode (sandbox|live), paypal.clientId,
 * paypal.clientSecretEnc (cifrado AES-GCM), paypal.webhookId.
 * NUNCA registrar en logs el client secret ni los tokens.
 */
import { db } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';

export type PayPalMode = 'sandbox' | 'live';

export interface PayPalConfig {
  mode: PayPalMode;
  clientId: string;
  clientSecret: string;
  webhookId: string;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    public readonly paypalName?: string,
  ) {
    super(message);
    this.name = 'PayPalError';
  }
}

export const PAYPAL_KEYS = {
  mode: 'paypal.mode',
  clientId: 'paypal.clientId',
  clientSecretEnc: 'paypal.clientSecretEnc',
  webhookId: 'paypal.webhookId',
} as const;

export function paypalBaseUrl(mode: PayPalMode): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

/** Lee la configuración guardada; secreto descifrado. Campos ausentes → ''. */
export async function readPayPalSettings(): Promise<PayPalConfig> {
  const rows = await db.appSetting.findMany({
    where: { key: { in: Object.values(PAYPAL_KEYS) } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  let clientSecret = '';
  if (str(map[PAYPAL_KEYS.clientSecretEnc])) {
    try {
      clientSecret = decryptSecret(str(map[PAYPAL_KEYS.clientSecretEnc]));
    } catch {
      clientSecret = '';
    }
  }
  return {
    mode: map[PAYPAL_KEYS.mode] === 'live' ? 'live' : 'sandbox',
    clientId: str(map[PAYPAL_KEYS.clientId]),
    clientSecret,
    webhookId: str(map[PAYPAL_KEYS.webhookId]),
  };
}

/** Configuración completa o PayPalError 400 si faltan credenciales. */
export async function getPayPalConfig(): Promise<PayPalConfig> {
  const cfg = await readPayPalSettings();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new PayPalError(
      'PayPal no está configurado. Añade el Client ID y el Secret en Administración → Monetización.',
      400,
    );
  }
  return cfg;
}

let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

/** Vacía la caché del token (al cambiar credenciales y en tests). */
export function clearPayPalTokenCache() {
  tokenCache = null;
}

export async function getAccessToken(cfg?: PayPalConfig): Promise<string> {
  const c = cfg ?? (await getPayPalConfig());
  const key = `${c.mode}:${c.clientId}`;
  if (tokenCache && tokenCache.key === key && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const res = await fetch(`${paypalBaseUrl(c.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new PayPalError(
      res.status === 401
        ? 'PayPal rechazó las credenciales. Revisa el Client ID, el Secret y el modo (sandbox/live).'
        : `PayPal no respondió correctamente (HTTP ${res.status}).`,
      res.status === 401 ? 400 : 502,
    );
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    key,
    token: json.access_token,
    expiresAt: Date.now() + Math.max(0, json.expires_in - 60) * 1000,
  };
  return json.access_token;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return {} as T;
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const name = typeof json.name === 'string' ? json.name : undefined;
    const msg = typeof json.message === 'string' ? json.message : `HTTP ${res.status}`;
    throw new PayPalError(`PayPal: ${msg}`, res.status >= 500 ? 502 : 400, name);
  }
  return json as T;
}

/** Importe en centavos → cadena decimal de PayPal ("10.00"). */
export function toPayPalAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function createOrder(o: {
  amountCents: number;
  currency: string;
  description: string;
  customId: string;
}): Promise<{ id: string; status: string }> {
  return call('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: { currency_code: o.currency, value: toPayPalAmount(o.amountCents) },
        description: o.description.slice(0, 127),
        custom_id: o.customId,
      },
    ],
  });
}

export interface PayPalCapture {
  id: string;
  status: string;
  amount?: { value: string; currency_code: string };
}

export async function captureOrder(
  orderId: string,
): Promise<{ id: string; status: string; capture: PayPalCapture | null; raw: unknown }> {
  const json = await call<{
    id: string;
    status: string;
    purchase_units?: Array<{ payments?: { captures?: PayPalCapture[] } }>;
  }>('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {});
  const capture = json.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
  return { id: json.id, status: json.status, capture, raw: json };
}

export async function createProduct(name: string): Promise<{ id: string }> {
  return call('POST', '/v1/catalogs/products', { name: name.slice(0, 127), type: 'SERVICE' });
}

export async function createBillingPlan(p: {
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: 'month' | 'year';
}): Promise<{ id: string }> {
  return call('POST', '/v1/billing/plans', {
    product_id: p.productId,
    name: p.name.slice(0, 127),
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: { interval_unit: p.interval === 'year' ? 'YEAR' : 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: toPayPalAmount(p.priceCents), currency_code: p.currency },
        },
      },
    ],
    payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
  });
}

export async function deactivateBillingPlan(planId: string): Promise<void> {
  await call('POST', `/v1/billing/plans/${encodeURIComponent(planId)}/deactivate`, {});
}

export interface PayPalSubscription {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  start_time?: string;
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string } };
}

export async function getSubscription(id: string): Promise<PayPalSubscription> {
  return call('GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
}

export async function cancelSubscription(id: string, reason: string): Promise<void> {
  await call('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
    reason: reason.slice(0, 127),
  });
}

const SIGNATURE_HEADERS = {
  auth_algo: 'paypal-auth-algo',
  cert_url: 'paypal-cert-url',
  transmission_id: 'paypal-transmission-id',
  transmission_sig: 'paypal-transmission-sig',
  transmission_time: 'paypal-transmission-time',
} as const;

/** Verifica la firma del webhook con la API de PayPal. false si falta algo o no es SUCCESS. */
export async function verifyWebhookSignature(
  headers: { get(name: string): string | null },
  rawBody: string,
): Promise<boolean> {
  const cfg = await readPayPalSettings();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.webhookId) return false;
  const fields: Record<string, string> = {};
  for (const [field, header] of Object.entries(SIGNATURE_HEADERS)) {
    const v = headers.get(header);
    if (!v) return false;
    fields[field] = v;
  }
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const res = await call<{ verification_status?: string }>(
    'POST',
    '/v1/notifications/verify-webhook-signature',
    { ...fields, webhook_id: cfg.webhookId, webhook_event: event },
  );
  return res.verification_status === 'SUCCESS';
}
