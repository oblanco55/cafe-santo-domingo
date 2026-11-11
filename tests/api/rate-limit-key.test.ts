import { describe, expect, it } from 'vitest';
import { rateLimitKey } from '@/lib/rate-limit';

/**
 * Tests de rateLimitKey: la IP es el ÚLTIMO valor no vacío de x-forwarded-for
 * (el proxy añade la IP real al final; el cliente puede prefijar valores falsos).
 */
describe('rateLimitKey', () => {
  it('x-forwarded-for: 1.1.1.1, 9.9.9.9 → usa 9.9.9.9 (último, no primer)', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.1.1.1, 9.9.9.9' });
    const key = rateLimitKey(headers, 'register');
    expect(key).toBe('register:9.9.9.9');
  });

  it('sin x-forwarded-for → usa x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '2.2.2.2' });
    const key = rateLimitKey(headers, 'register');
    expect(key).toBe('register:2.2.2.2');
  });

  it('sin cabeceras → usa "unknown"', () => {
    const headers = new Headers();
    const key = rateLimitKey(headers, 'register');
    expect(key).toBe('register:unknown');
  });

  it('x-forwarded-for con valores vacíos intermedios → último no vacío', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.1.1.1, ,   , 7.7.7.7' });
    const key = rateLimitKey(headers, 'register');
    expect(key).toBe('register:7.7.7.7');
  });
});
