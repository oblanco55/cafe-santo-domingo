/**
 * Motor de derechos de creación (ORDEN F2-7a, regla de PLAN-F2.md §F2-7):
 *  1. Monetización desactivada o usuario admin → permitido.
 *  2. Suscripción ACTIVA → permitido hasta la cuota del plan en su periodo (null = ilimitado).
 *  3. Creaciones gratis del mes (calendario UTC) < cuota gratuita → permitido.
 *  4. Saldo de créditos > 0 → permitido, consume 1 crédito.
 *  5. Si no → no permitido (la ruta responde 402 PAYMENT_REQUIRED).
 * Solo se descuenta cuando la creación termina con éxito.
 */
import { db } from '@/lib/db';
import { getMonetizationSettings } from './settings';

export type BillingSource = 'admin' | 'disabled' | 'subscription' | 'free' | 'credit';

export type CanCreate = { allowed: true; source: BillingSource } | { allowed: false };

export interface UsageSummary {
  monetizationEnabled: boolean;
  freeUsedThisMonth: number;
  freeQuota: number;
  credits: number;
  subscription: {
    plan: string;
    status: string;
    used: number;
    quota: number | null;
    periodEnd: Date | null;
  } | null;
}

function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Suscripción vigente (ACTIVE y con periodo no vencido) con su plan. */
async function activeSubscription(userId: string) {
  const now = new Date();
  return db.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function countOk(userId: string, source: BillingSource, since: Date): Promise<number> {
  return db.creation.count({
    where: { userId, status: 'ok', billingSource: source, createdAt: { gte: since } },
  });
}

export async function getCreditBalance(userId: string): Promise<number> {
  const agg = await db.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } });
  return agg._sum.delta ?? 0;
}

export async function getUsage(userId: string): Promise<UsageSummary> {
  const settings = await getMonetizationSettings();
  const [freeUsedThisMonth, credits, sub] = await Promise.all([
    countOk(userId, 'free', monthStartUtc()),
    getCreditBalance(userId),
    activeSubscription(userId),
  ]);
  return {
    monetizationEnabled: settings.enabled,
    freeUsedThisMonth,
    freeQuota: settings.freeCreationsPerMonth,
    credits,
    subscription: sub
      ? {
          plan: sub.plan.name,
          status: sub.status,
          used: await countOk(userId, 'subscription', sub.currentPeriodStart ?? sub.createdAt),
          quota: sub.plan.creationsPerPeriod,
          periodEnd: sub.currentPeriodEnd,
        }
      : null,
  };
}

export async function checkCanCreate(user: { id: string; role?: string | null }): Promise<CanCreate> {
  const settings = await getMonetizationSettings();
  if (!settings.enabled) return { allowed: true, source: 'disabled' };
  if (user.role === 'admin') return { allowed: true, source: 'admin' };

  const sub = await activeSubscription(user.id);
  if (sub) {
    const quota = sub.plan.creationsPerPeriod;
    if (quota === null) return { allowed: true, source: 'subscription' };
    const used = await countOk(user.id, 'subscription', sub.currentPeriodStart ?? sub.createdAt);
    if (used < quota) return { allowed: true, source: 'subscription' };
  }

  const freeUsed = await countOk(user.id, 'free', monthStartUtc());
  if (freeUsed < settings.freeCreationsPerMonth) return { allowed: true, source: 'free' };

  if ((await getCreditBalance(user.id)) > 0) return { allowed: true, source: 'credit' };

  return { allowed: false };
}

/** Registra el cargo de una creación terminada con éxito (solo los créditos generan movimiento). */
export async function recordCreationCharge(
  userId: string,
  creationId: string,
  source: BillingSource,
): Promise<void> {
  if (source !== 'credit') return;
  await db.creditLedger.create({
    data: { userId, delta: -1, reason: 'creation', refType: 'creation', refId: creationId },
  });
}

export const PAYMENT_REQUIRED_MESSAGE =
  'Alcanzaste tu límite gratuito. Elige un plan o un paquete de créditos para seguir creando.';
