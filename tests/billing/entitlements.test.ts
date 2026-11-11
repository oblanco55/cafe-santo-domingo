/**
 * F2-7a — Motor de derechos de creación (regla de PLAN-F2.md §F2-7).
 * Mockea @/lib/db con un almacén en memoria; no requiere BD real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
const store = {
  settings: [] as Row[],
  creations: [] as Row[],
  ledger: [] as Row[],
  subs: [] as Row[],
};

function matchCreation(c: Row, w: Row) {
  return (
    c.userId === w.userId &&
    c.status === w.status &&
    c.billingSource === w.billingSource &&
    c.createdAt >= w.createdAt.gte
  );
}

vi.mock('@/lib/db', () => ({
  db: {
    appSetting: {
      findMany: vi.fn(async ({ where }: Row) =>
        store.settings.filter((s) => where.key.in.includes(s.key)),
      ),
    },
    creation: {
      count: vi.fn(async ({ where }: Row) => store.creations.filter((c) => matchCreation(c, where)).length),
    },
    creditLedger: {
      aggregate: vi.fn(async ({ where }: Row) => {
        const rows = store.ledger.filter((l) => l.userId === where.userId);
        return { _sum: { delta: rows.length ? rows.reduce((a, l) => a + l.delta, 0) : null } };
      }),
      create: vi.fn(async ({ data }: Row) => {
        store.ledger.push(data);
        return data;
      }),
    },
    subscription: {
      findFirst: vi.fn(async ({ where }: Row) => {
        const now = new Date();
        return (
          store.subs.find(
            (s) =>
              s.userId === where.userId &&
              s.status === 'ACTIVE' &&
              (s.currentPeriodEnd === null || s.currentPeriodEnd > now),
          ) ?? null
        );
      }),
    },
  },
}));

import {
  checkCanCreate,
  getUsage,
  recordCreationCharge,
} from '@/lib/billing/entitlements';
import { clearMonetizationSettingsCache } from '@/lib/billing/settings';

const USER = { id: 'u1', role: 'user' };

function enable(free = 2) {
  store.settings.push(
    { key: 'monetization.enabled', value: true },
    { key: 'limits.freeCreationsPerMonth', value: free },
  );
}

function created(source: string, status = 'ok') {
  store.creations.push({ userId: 'u1', status, billingSource: source, createdAt: new Date() });
}

/** Simula el ciclo de la ruta: comprobar → crear con éxito → cargar. */
async function createOnce() {
  const access = await checkCanCreate(USER);
  if (!access.allowed) return access;
  created(access.source);
  await recordCreationCharge('u1', `c${store.creations.length}`, access.source);
  return access;
}

beforeEach(() => {
  store.settings = [];
  store.creations = [];
  store.ledger = [];
  store.subs = [];
  clearMonetizationSettingsCache();
});

describe('checkCanCreate', () => {
  it('monetización desactivada → permitido sin consumir', async () => {
    expect(await checkCanCreate(USER)).toEqual({ allowed: true, source: 'disabled' });
  });

  it('admin → permitido aunque no tenga cuota', async () => {
    enable(0);
    expect(await checkCanCreate({ id: 'u1', role: 'admin' })).toEqual({ allowed: true, source: 'admin' });
  });

  it('gratis hasta la cuota y luego no permitido', async () => {
    enable(2);
    expect(await createOnce()).toEqual({ allowed: true, source: 'free' });
    expect(await createOnce()).toEqual({ allowed: true, source: 'free' });
    expect(await createOnce()).toEqual({ allowed: false });
  });

  it('con créditos consume 1 y el saldo baja', async () => {
    enable(0);
    store.ledger.push({ userId: 'u1', delta: 2, reason: 'purchase' });
    expect(await createOnce()).toEqual({ allowed: true, source: 'credit' });
    expect((await getUsage('u1')).credits).toBe(1);
    expect(await createOnce()).toEqual({ allowed: true, source: 'credit' });
    expect(await createOnce()).toEqual({ allowed: false });
  });

  it('suscripción activa con cuota: la agota y pasa a la capa gratuita', async () => {
    enable(1);
    store.subs.push({
      userId: 'u1', status: 'ACTIVE', currentPeriodStart: new Date(Date.now() - 1000),
      currentPeriodEnd: new Date(Date.now() + 86_400_000), createdAt: new Date(),
      plan: { name: 'Básico', creationsPerPeriod: 1 },
    });
    expect(await createOnce()).toEqual({ allowed: true, source: 'subscription' });
    expect(await createOnce()).toEqual({ allowed: true, source: 'free' });
    expect(await createOnce()).toEqual({ allowed: false });
  });

  it('suscripción ilimitada siempre permite', async () => {
    enable(0);
    store.subs.push({
      userId: 'u1', status: 'ACTIVE', currentPeriodStart: null, currentPeriodEnd: null,
      createdAt: new Date(), plan: { name: 'Pro', creationsPerPeriod: null },
    });
    for (let i = 0; i < 5; i++) expect((await createOnce()).allowed).toBe(true);
  });

  it('una creación fallida no consume cuota', async () => {
    enable(1);
    created('free', 'error');
    expect(await checkCanCreate(USER)).toEqual({ allowed: true, source: 'free' });
  });
});

describe('recordCreationCharge', () => {
  it('solo los créditos generan movimiento en el libro', async () => {
    await recordCreationCharge('u1', 'c1', 'free');
    await recordCreationCharge('u1', 'c2', 'subscription');
    expect(store.ledger).toHaveLength(0);
    await recordCreationCharge('u1', 'c3', 'credit');
    expect(store.ledger).toEqual([
      { userId: 'u1', delta: -1, reason: 'creation', refType: 'creation', refId: 'c3' },
    ]);
  });
});
