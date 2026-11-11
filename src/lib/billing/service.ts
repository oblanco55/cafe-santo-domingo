/**
 * Lógica de monetización para las rutas (ORDEN F2-7b): ajustes, planes,
 * paquetes, pagos, créditos manuales, compras, suscripciones y webhook.
 * Las rutas solo autentican, validan el cuerpo y llaman aquí.
 */
import { z } from 'zod';
import { db } from '@/lib/db';
import { encryptSecret, maskSecret } from '@/lib/crypto';
import { logAdminAction, type Admin } from '@/lib/audit';
import { clearMonetizationSettingsCache, getMonetizationSettings } from './settings';
import {
  PAYPAL_KEYS,
  PayPalError,
  cancelSubscription as paypalCancel,
  captureOrder,
  clearPayPalTokenCache,
  createBillingPlan,
  createOrder,
  createProduct,
  getAccessToken,
  getSubscription,
  readPayPalSettings,
} from './paypal';

/** Error de negocio con status HTTP (400 validación, 404, 409). */
export class BillingError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

type Json = Parameters<typeof db.appSetting.upsert>[0]['create']['value'];
const toJson = (v: unknown) => JSON.parse(JSON.stringify(v ?? null)) as Json;

// ── Ajustes ──────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'BRL', 'CAD', 'GBP'] as const;

export const billingSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  freeCreationsPerMonth: z.number().int().min(0).max(10_000).optional(),
  currency: z.enum(CURRENCIES).optional(),
  paypal: z
    .object({
      mode: z.enum(['sandbox', 'live']).optional(),
      clientId: z.string().trim().max(200).optional(),
      clientSecret: z.string().trim().max(200).optional(),
      webhookId: z.string().trim().max(100).optional(),
    })
    .optional(),
});
export type BillingSettingsUpdate = z.infer<typeof billingSettingsUpdateSchema>;

export async function getBillingSettings() {
  const [m, p] = await Promise.all([getMonetizationSettings(), readPayPalSettings()]);
  return {
    enabled: m.enabled,
    freeCreationsPerMonth: m.freeCreationsPerMonth,
    currency: m.currency,
    currencies: CURRENCIES,
    paypal: {
      mode: p.mode,
      clientId: p.clientId,
      clientSecretMasked: p.clientSecret ? maskSecret(p.clientSecret) : null,
      webhookId: p.webhookId,
      configured: Boolean(p.clientId && p.clientSecret),
    },
  };
}

export async function updateBillingSettings(admin: Admin, u: BillingSettingsUpdate) {
  const updates: Array<[string, unknown]> = [];
  if (u.enabled !== undefined) updates.push(['monetization.enabled', u.enabled]);
  if (u.freeCreationsPerMonth !== undefined)
    updates.push(['limits.freeCreationsPerMonth', u.freeCreationsPerMonth]);
  if (u.currency !== undefined) updates.push(['monetization.currency', u.currency]);
  if (u.paypal?.mode !== undefined) updates.push([PAYPAL_KEYS.mode, u.paypal.mode]);
  if (u.paypal?.clientId !== undefined) updates.push([PAYPAL_KEYS.clientId, u.paypal.clientId]);
  if (u.paypal?.webhookId !== undefined) updates.push([PAYPAL_KEYS.webhookId, u.paypal.webhookId]);
  // Secreto vacío = no cambiar.
  if (u.paypal?.clientSecret) {
    updates.push([PAYPAL_KEYS.clientSecretEnc, encryptSecret(u.paypal.clientSecret)]);
  }

  await db.$transaction(
    updates.map(([key, value]) =>
      db.appSetting.upsert({
        where: { key },
        create: { key, value: toJson(value), updatedBy: admin.id },
        update: { value: toJson(value), updatedBy: admin.id },
      }),
    ),
  );
  clearMonetizationSettingsCache();
  clearPayPalTokenCache();
  await logAdminAction(admin, 'billing.settings.update', null, {
    keys: updates.map(([k]) => k),
  });
  return getBillingSettings();
}

export async function testPayPalConnection(): Promise<{ ok: true; mode: string; latencyMs: number }> {
  const cfg = await readPayPalSettings();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new PayPalError('Faltan el Client ID o el Secret de PayPal.', 400);
  }
  clearPayPalTokenCache();
  const t0 = Date.now();
  await getAccessToken(cfg);
  return { ok: true, mode: cfg.mode, latencyMs: Date.now() - t0 };
}

// ── Planes ───────────────────────────────────────────────────────

export const planInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).nullish(),
  priceCents: z.number().int().min(100).max(1_000_000),
  currency: z.enum(CURRENCIES).optional(),
  interval: z.enum(['month', 'year']),
  creationsPerPeriod: z.number().int().min(1).max(100_000).nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export const planUpdateSchema = planInputSchema.partial();

/** Crea producto (una vez) y billing plan en PayPal para un plan activo. */
async function syncPlanWithPayPal(plan: {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: 'month' | 'year';
  paypalProductId: string | null;
}) {
  const productId = plan.paypalProductId ?? (await createProduct(`Café Santo Domingo — ${plan.name}`)).id;
  const billing = await createBillingPlan({
    productId,
    name: plan.name,
    priceCents: plan.priceCents,
    currency: plan.currency,
    interval: plan.interval,
  });
  return db.plan.update({
    where: { id: plan.id },
    data: { paypalProductId: productId, paypalPlanId: billing.id },
  });
}

export async function listPlans() {
  return db.plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
}

export async function createPlan(admin: Admin, input: z.infer<typeof planInputSchema>) {
  const currency = input.currency ?? (await getMonetizationSettings()).currency;
  const active = input.active ?? true;
  if (active) await ensurePayPalConfigured();
  const plan = await db.plan.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      priceCents: input.priceCents,
      currency,
      interval: input.interval,
      creationsPerPeriod: input.creationsPerPeriod,
      active,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  const saved = active ? await syncPlanWithPayPal(plan) : plan;
  await logAdminAction(admin, 'billing.plan.create', plan.id, { name: plan.name });
  return saved;
}

export async function updatePlan(admin: Admin, id: string, input: z.infer<typeof planUpdateSchema>) {
  const current = await db.plan.findUnique({ where: { id } });
  if (!current) throw new BillingError('Plan no encontrado.', 404);
  const next = {
    ...current,
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
  } as typeof current;
  const pricingChanged =
    next.priceCents !== current.priceCents ||
    next.interval !== current.interval ||
    next.currency !== current.currency;
  const needsSync = next.active && (pricingChanged || !current.paypalPlanId);
  if (needsSync) await ensurePayPalConfigured();

  const plan = await db.plan.update({
    where: { id },
    data: {
      name: next.name,
      description: next.description,
      priceCents: next.priceCents,
      currency: next.currency,
      interval: next.interval,
      creationsPerPeriod: next.creationsPerPeriod,
      active: next.active,
      sortOrder: next.sortOrder,
    },
  });
  // Un billing plan de PayPal no admite cambiar precio/intervalo: se crea otro.
  // Los suscriptores existentes siguen en el anterior.
  const saved = needsSync ? await syncPlanWithPayPal(plan) : plan;
  await logAdminAction(admin, 'billing.plan.update', id, { fields: Object.keys(input) });
  return saved;
}

/** Desactiva el plan (no se borra: puede tener suscripciones). */
export async function deactivatePlan(admin: Admin, id: string) {
  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) throw new BillingError('Plan no encontrado.', 404);
  const saved = await db.plan.update({ where: { id }, data: { active: false } });
  await logAdminAction(admin, 'billing.plan.deactivate', id);
  return saved;
}

async function ensurePayPalConfigured() {
  const cfg = await readPayPalSettings();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new BillingError(
      'Configura primero las credenciales de PayPal para poder publicar planes de suscripción.',
      400,
    );
  }
}

// ── Paquetes de créditos ─────────────────────────────────────────

export const packInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  credits: z.number().int().min(1).max(100_000),
  priceCents: z.number().int().min(100).max(1_000_000),
  currency: z.enum(CURRENCIES).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export const packUpdateSchema = packInputSchema.partial();

export async function listPacks() {
  return db.creditPack.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
}

export async function createPack(admin: Admin, input: z.infer<typeof packInputSchema>) {
  const currency = input.currency ?? (await getMonetizationSettings()).currency;
  const pack = await db.creditPack.create({
    data: {
      name: input.name,
      credits: input.credits,
      priceCents: input.priceCents,
      currency,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  await logAdminAction(admin, 'billing.pack.create', pack.id, { name: pack.name });
  return pack;
}

export async function updatePack(admin: Admin, id: string, input: z.infer<typeof packUpdateSchema>) {
  const exists = await db.creditPack.findUnique({ where: { id } });
  if (!exists) throw new BillingError('Paquete no encontrado.', 404);
  const pack = await db.creditPack.update({ where: { id }, data: input });
  await logAdminAction(admin, 'billing.pack.update', id, { fields: Object.keys(input) });
  return pack;
}

export async function deactivatePack(admin: Admin, id: string) {
  const exists = await db.creditPack.findUnique({ where: { id } });
  if (!exists) throw new BillingError('Paquete no encontrado.', 404);
  const pack = await db.creditPack.update({ where: { id }, data: { active: false } });
  await logAdminAction(admin, 'billing.pack.deactivate', id);
  return pack;
}

// ── Pagos y créditos (admin) ─────────────────────────────────────

export async function listPayments(page: number, pageSize: number) {
  const [count, items] = await Promise.all([
    db.payment.count(),
    db.payment.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        kind: true,
        status: true,
        amountCents: true,
        currency: true,
        paypalOrderId: true,
        paypalCaptureId: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);
  return { count, page, pageSize, items };
}

export const creditAdjustSchema = z.object({
  userId: z.string().min(1),
  delta: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((d) => d !== 0, 'El ajuste no puede ser 0.'),
  note: z.string().trim().max(200).optional(),
});

export async function adjustCredits(admin: Admin, input: z.infer<typeof creditAdjustSchema>) {
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new BillingError('Usuario no encontrado.', 404);
  const row = await db.creditLedger.create({
    data: {
      userId: input.userId,
      delta: input.delta,
      reason: 'admin_adjust',
      refType: 'admin',
      refId: admin.id,
    },
  });
  await logAdminAction(admin, 'billing.credits.adjust', input.userId, {
    delta: input.delta,
    note: input.note ?? null,
  });
  return row;
}

// ── Catálogo público ─────────────────────────────────────────────

export async function getCatalog() {
  const [settings, paypal, plans, packs] = await Promise.all([
    getMonetizationSettings(),
    readPayPalSettings(),
    db.plan.findMany({
      where: { active: true, paypalPlanId: { not: null } },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        priceCents: true,
        currency: true,
        interval: true,
        creationsPerPeriod: true,
        paypalPlanId: true,
      },
    }),
    db.creditPack.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: { id: true, name: true, credits: true, priceCents: true, currency: true },
    }),
  ]);
  return {
    enabled: settings.enabled,
    freeCreationsPerMonth: settings.freeCreationsPerMonth,
    currency: settings.currency,
    paypal: { clientId: paypal.clientId || null, mode: paypal.mode },
    plans,
    packs,
  };
}

// ── Compra de paquetes ───────────────────────────────────────────

export async function createPackOrder(userId: string, packId: string) {
  const pack = await db.creditPack.findFirst({ where: { id: packId, active: true } });
  if (!pack) throw new BillingError('Paquete no disponible.', 404);
  const order = await createOrder({
    amountCents: pack.priceCents,
    currency: pack.currency,
    description: `Café Santo Domingo — ${pack.name} (${pack.credits} créditos)`,
    customId: `${userId}:${pack.id}`,
  });
  await db.payment.create({
    data: {
      userId,
      kind: 'credit_pack',
      paypalOrderId: order.id,
      amountCents: pack.priceCents,
      currency: pack.currency,
      status: 'created',
      raw: toJson({ packId: pack.id, credits: pack.credits }),
    },
  });
  return { orderId: order.id };
}

function packCreditsOf(raw: unknown): number {
  const c = (raw as { credits?: unknown } | null)?.credits;
  return typeof c === 'number' ? c : 0;
}

/**
 * Captura la orden y acredita los créditos una sola vez (idempotente:
 * si el pago ya está completado no vuelve a capturar ni acreditar).
 */
export async function capturePackOrder(userId: string, orderId: string) {
  const payment = await db.payment.findUnique({ where: { paypalOrderId: orderId } });
  if (!payment || payment.userId !== userId) throw new BillingError('Pedido no encontrado.', 404);
  const credits = packCreditsOf(payment.raw);
  if (payment.status === 'completed') return { status: 'COMPLETED', credits, alreadyProcessed: true };

  const result = await captureOrder(orderId);
  const cap = result.capture;
  if (result.status !== 'COMPLETED' || !cap || cap.status !== 'COMPLETED') {
    await db.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    throw new BillingError('PayPal no completó el pago. No se ha cobrado ningún crédito.', 402);
  }
  const expected = (payment.amountCents / 100).toFixed(2);
  if (cap.amount && (cap.amount.value !== expected || cap.amount.currency_code !== payment.currency)) {
    await db.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    throw new BillingError('El importe cobrado no coincide con el paquete.', 409);
  }

  await completePackPayment(payment.id, cap.id, userId, credits);
  return { status: 'COMPLETED', credits, alreadyProcessed: false };
}

/** Marca completado y acredita en una transacción; el unique de captureId evita dobles abonos. */
async function completePackPayment(paymentId: string, captureId: string, userId: string, credits: number) {
  const done = await db.payment.updateMany({
    where: { id: paymentId, status: { not: 'completed' } },
    data: { status: 'completed', paypalCaptureId: captureId },
  });
  if (done.count === 0) return;
  await db.creditLedger.create({
    data: { userId, delta: credits, reason: 'purchase', refType: 'payment', refId: paymentId },
  });
}

// ── Suscripciones ────────────────────────────────────────────────

export const confirmSubscriptionSchema = z.object({
  subscriptionId: z.string().trim().min(3).max(64),
  planId: z.string().trim().min(1),
});

function periodFrom(s: { start_time?: string; billing_info?: { next_billing_time?: string; last_payment?: { time?: string } } }) {
  const start = s.billing_info?.last_payment?.time ?? s.start_time;
  const end = s.billing_info?.next_billing_time;
  return {
    currentPeriodStart: start ? new Date(start) : new Date(),
    currentPeriodEnd: end ? new Date(end) : null,
  };
}

export async function confirmSubscription(
  userId: string,
  input: z.infer<typeof confirmSubscriptionSchema>,
) {
  const plan = await db.plan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.paypalPlanId) throw new BillingError('Plan no disponible.', 404);

  let sub = await getSubscription(input.subscriptionId);
  if (sub.status === 'APPROVAL_PENDING') {
    await new Promise((r) => setTimeout(r, 1500));
    sub = await getSubscription(input.subscriptionId);
  }
  if (sub.plan_id !== plan.paypalPlanId) {
    throw new BillingError('La suscripción no corresponde a este plan.', 400);
  }
  if (sub.custom_id && sub.custom_id !== userId) {
    throw new BillingError('La suscripción pertenece a otra cuenta.', 403);
  }
  if (sub.status !== 'ACTIVE') {
    throw new BillingError('PayPal aún no ha activado la suscripción. Inténtalo en unos segundos.', 409);
  }

  const existing = await db.subscription.findUnique({
    where: { paypalSubscriptionId: sub.id },
  });
  if (existing && existing.userId !== userId) {
    throw new BillingError('La suscripción pertenece a otra cuenta.', 403);
  }
  const period = periodFrom(sub);
  const saved = await db.subscription.upsert({
    where: { paypalSubscriptionId: sub.id },
    create: { userId, planId: plan.id, paypalSubscriptionId: sub.id, status: 'ACTIVE', ...period },
    update: { status: 'ACTIVE', planId: plan.id, ...period },
  });
  await db.payment.create({
    data: {
      userId,
      kind: 'subscription',
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: 'completed',
      raw: toJson({ subscriptionId: sub.id, planId: plan.id }),
    },
  });
  return saved;
}

export async function cancelUserSubscription(userId: string) {
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'SUSPENDED', 'APPROVAL_PENDING'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub) throw new BillingError('No tienes una suscripción activa.', 404);
  await paypalCancel(sub.paypalSubscriptionId, 'Cancelada por el usuario desde Café Santo Domingo');
  return db.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } });
}

// ── Webhook ──────────────────────────────────────────────────────

interface WebhookEvent {
  id: string;
  event_type: string;
  resource?: Record<string, unknown>;
}

const SUB_STATUS: Record<string, 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED'> = {
  'BILLING.SUBSCRIPTION.ACTIVATED': 'ACTIVE',
  'BILLING.SUBSCRIPTION.CANCELLED': 'CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED': 'SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED': 'EXPIRED',
};

/** Procesa un evento ya verificado. Idempotente por event.id. Devuelve false si ya estaba procesado. */
export async function processWebhookEvent(event: WebhookEvent): Promise<boolean> {
  // Reserva el id primero: dos entregas simultáneas no se procesan dos veces.
  try {
    await db.paymentEvent.create({
      data: { id: event.id, type: event.event_type, payload: toJson(event) },
    });
  } catch {
    return false;
  }
  try {
    await applyWebhookEvent(event);
  } catch (e) {
    // Libera el id para que el reintento de PayPal lo procese.
    await db.paymentEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    throw e;
  }
  return true;
}

async function applyWebhookEvent(event: WebhookEvent): Promise<void> {
  const r = event.resource ?? {};
  const type = event.event_type;

  if (SUB_STATUS[type] && typeof r.id === 'string') {
    await db.subscription.updateMany({
      where: { paypalSubscriptionId: r.id },
      data: { status: SUB_STATUS[type] },
    });
  } else if (type === 'PAYMENT.SALE.COMPLETED' && typeof r.billing_agreement_id === 'string') {
    // Renovación: el periodo nuevo se toma de PayPal.
    const sub = await getSubscription(r.billing_agreement_id);
    await db.subscription.updateMany({
      where: { paypalSubscriptionId: sub.id },
      data: { status: 'ACTIVE', ...periodFrom(sub) },
    });
  } else if (type === 'PAYMENT.CAPTURE.COMPLETED' && typeof r.id === 'string') {
    // Respaldo por si el navegador se cerró antes de confirmar la captura.
    const orderId = (r.supplementary_data as { related_ids?: { order_id?: string } } | undefined)
      ?.related_ids?.order_id;
    if (orderId) {
      const payment = await db.payment.findUnique({ where: { paypalOrderId: orderId } });
      if (payment && payment.kind === 'credit_pack') {
        await completePackPayment(payment.id, r.id, payment.userId, packCreditsOf(payment.raw));
      }
    }
  } else if (type === 'PAYMENT.CAPTURE.REFUNDED') {
    const links = (r.links as Array<{ rel?: string; href?: string }> | undefined) ?? [];
    const up = links.find((l) => l.rel === 'up')?.href ?? '';
    const captureId = up.split('/captures/')[1]?.split(/[/?]/)[0] ?? '';
    if (captureId) {
      const payment = await db.payment.findUnique({ where: { paypalCaptureId: captureId } });
      if (payment && payment.status !== 'refunded') {
        await db.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
        const credits = packCreditsOf(payment.raw);
        if (credits > 0) {
          await db.creditLedger.create({
            data: {
              userId: payment.userId,
              delta: -credits,
              reason: 'refund',
              refType: 'payment',
              refId: payment.id,
            },
          });
        }
      }
    }
  }
}
