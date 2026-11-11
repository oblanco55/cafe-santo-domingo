/**
 * Ajustes de monetización (ORDEN F2-7a), leídos de AppSetting con caché de 60 s.
 * Claves: monetization.enabled, limits.freeCreationsPerMonth, monetization.currency.
 */
import { db } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/contracts/admin';

export interface MonetizationSettings {
  enabled: boolean;
  freeCreationsPerMonth: number;
  currency: string;
}

const TTL_MS = 60_000;
let cache: { at: number; value: MonetizationSettings } | null = null;

/** Vacía la caché (tras guardar ajustes en el panel y en tests). */
export function clearMonetizationSettingsCache() {
  cache = null;
}

export async function getMonetizationSettings(): Promise<MonetizationSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await db.appSetting.findMany({
    where: {
      key: { in: ['monetization.enabled', 'limits.freeCreationsPerMonth', 'monetization.currency'] },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const free = Number(map['limits.freeCreationsPerMonth']);
  const currency = map['monetization.currency'];
  const value: MonetizationSettings = {
    enabled: map['monetization.enabled'] === true,
    freeCreationsPerMonth:
      Number.isInteger(free) && free >= 0 ? free : DEFAULT_SETTINGS.limits.freeCreationsPerMonth,
    currency: typeof currency === 'string' && currency ? currency : 'USD',
  };
  cache = { at: Date.now(), value };
  return value;
}
