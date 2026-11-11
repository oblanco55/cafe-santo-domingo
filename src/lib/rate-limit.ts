/**
 * Rate limit simple en memoria por clave (IP + endpoint).
 * - 10 intentos por cada 10 minutos por defecto.
 * - Se purga la ventana vencida para no acumular memoria.
 *
 * NOTA: en memoria → se reinicia con cada worker/reinicio. Suficiente para el
 * alcance de SCRIPT 28 (orden T3a punto 3); si se escala a producción con
 * múltiples instancias, sustituir por un store compartido.
 */
const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_ATTEMPTS = 10;

type Bucket = { start: number; count: number };

const buckets = new Map<string, Bucket>();

function purge(now: number) {
  for (const [key, b] of buckets) {
    if (now - b.start >= WINDOW_MS) buckets.delete(key);
  }
}

export interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

export function checkRateLimit(key: string, now: number = Date.now()): RateLimitCheck {
  purge(now);
  let b = buckets.get(key);
  if (!b || now - b.start >= WINDOW_MS) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  const remaining = Math.max(0, MAX_ATTEMPTS - b.count);
  const retryAfterMs =
    b.count > MAX_ATTEMPTS ? Math.max(0, b.start + WINDOW_MS - now) : 0;
  return { allowed: b.count <= MAX_ATTEMPTS, retryAfterMs, remaining };
}

/**
 * Genera una clave estable para un request.
 * La IP cliente viene del ÚLTIMO valor no vacío de x-forwarded-for:
 * el proxy añade la IP real al final, pero el cliente puede prefijar
 * valores falsos al inicio. Si no hay cabecera, usa x-real-ip; si no, 'unknown'.
 */
export function rateLimitKey(headers: Headers, scope: string): string {
  const fwd = headers.get('x-forwarded-for');
  const ip = fwd
    ? fwd.split(',').map(s => s.trim()).filter(Boolean).at(-1)
    : (headers.get('x-real-ip') ?? 'unknown');
  return `${scope}:${ip}`;
}
