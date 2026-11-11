import { afterEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/crypto';

/**
 * Tests de src/lib/crypto.ts (Fase 2).
 *
 * - Ida y vuelta: el texto recuperado coincide con el original.
 * - Clave errónea: descifrar con otra clave lanza error (autenticación GCM).
 * - Clave ausente: falla con "Falta SETTINGS_ENCRYPTION_KEY".
 * - maskSecret: oculta el secreto pero conserva los últimos 4 caracteres.
 *
 * Usa una clave de prueba fija (no es un secreto): 32 bytes base64.
 */

const TEST_KEY_B64 = Buffer.from(
  '0123456789abcdef0123456789abcdef',
  'utf8',
).toString('base64');

const OTHER_KEY_B64 = Buffer.from(
  'fedcba9876543210fedcba9876543210',
  'utf8',
).toString('base64');

afterEach(() => {
  delete process.env.SETTINGS_ENCRYPTION_KEY;
});

describe('encryptSecret / decryptSecret', () => {
  it('cifrará y descrifrá el texto original sin pérdida', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_KEY_B64;
    const plain = 'clave-secreta-12345, unicode: ¡hola! ñ';
    const enc = encryptSecret(plain);
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc.split(':')).toHaveLength(4);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('genera un ciphertext distinto para cada llave (IV aleatoria)', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_KEY_B64;
    const a = encryptSecret('mismo-texto');
    const b = encryptSecret('mismo-texto');
    expect(a).not.toBe(b);
    // ambos deben descifrarse igual
    expect(decryptSecret(a)).toBe('mismo-texto');
    expect(decryptSecret(b)).toBe('mismo-texto');
  });

  it('descifrar con una clave distinta falla (autenticación GCM)', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_KEY_B64;
    const enc = encryptSecret('secreto-abc');

    process.env.SETTINGS_ENCRYPTION_KEY = OTHER_KEY_B64;
    expect(() => decryptSecret(enc)).toThrow();
  });

  it('sin SETTINGS_ENCRYPTION_KEY: falla con un Error claro', () => {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    expect(() => encryptSecret('x')).toThrowError(/Falta SETTINGS_ENCRYPTION_KEY/);
    // Decrypt sin clave: la clave se lee antes de parsear el formato, así que
    // falla por la clave ausente (y no por el formato).
    expect(() => decryptSecret('v1:AAAA:BBBB:CCCC')).toThrowError(
      /Falta SETTINGS_ENCRYPTION_KEY/,
    );
  });

  it('rechaza claves que no son base64 de 32 bytes', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = Buffer.from('corta').toString('base64');
    expect(() => encryptSecret('x')).toThrowError(/32 bytes/);
  });

  it('descifrar un formato inválido falla con error claro', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_KEY_B64;
    expect(() => decryptSecret('v2:bogus')).toThrowError(/Formato.*inválido|v1/);
    expect(() => decryptSecret('abc')).toThrow();
    expect(() => decryptSecret('')).toThrow();
  });

  it('descifrar un tag corrupto falla (integridad)', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_KEY_B64;
    const enc = encryptSecret('texto-intacto');
    const [v, iv, tag, data] = enc.split(':');
    const flipped = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
    expect(() => decryptSecret(`${v}:${iv}:${flipped}:${data}`)).toThrow();
  });
});

describe('maskSecret', () => {
  it('muestra "••••" + últimos 4', () => {
    expect(maskSecret('secret1234')).toBe('••••1234');
    expect(maskSecret('sk-live-abcdef12')).toContain('••••');
    expect(maskSecret('sk-live-abcdef12')).toBe('••••ef12');
    expect(maskSecret('abcdefghijkl')).toBe('••••ijkl');
  });

  it('vacío → solo los puntos', () => {
    expect(maskSecret('')).toBe('••••');
  });

  it('mantiene el texto visible corto (<=4) con la misma máscara', () => {
    expect(maskSecret('abcd')).toBe('••••abcd');
    expect(maskSecret('abc')).toBe('••••abc');
    expect(maskSecret('a')).toBe('••••a');
  });

  it('punto 5: maskSecret(decryptSecret(encryptSecret(clave))) → últimos 4 reales', () => {
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_KEY_B64;
    const apiKey = 'sk-anthropic-abcdef1234567890';
    const encrypted = encryptSecret(apiKey);
    const decrypted = decryptSecret(encrypted);
    const masked = maskSecret(decrypted);
    expect(masked).toBe('••••98567890'.slice(0, 4) + apiKey.slice(-4));
    // La última parte debe ser los últimos 4 de la clave REAL
    expect(masked.endsWith(apiKey.slice(-4))).toBe(true);
    expect(masked.startsWith('••••')).toBe(true);
    expect(masked).not.toContain(apiKey);
  });
});
