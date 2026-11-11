import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/contracts';

const base = {
  name: 'Omar Rivas',
  email: 'omar.rivas@example.com',
  password: 'MiClave1',
  acceptTerms: true as const,
};

describe('registerSchema', () => {
  it('acepta un registro válido', () => {
    const r = registerSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe(base.email.toLowerCase());
    }
  });

  it('normaliza el email a minúsculas', () => {
    const r = registerSchema.safeParse({ ...base, email: 'OMAR.RIVAS@Example.COM' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('omar.rivas@example.com');
  });

  it('rechaza nombre corto', () => {
    expect(registerSchema.safeParse({ ...base, name: 'O' }).success).toBe(false);
  });

  it('rechaza nombre largo (más de 80)', () => {
    expect(
      registerSchema.safeParse({ ...base, name: 'x'.repeat(81) }).success,
    ).toBe(false);
  });

  it('rechaza email inválido', () => {
    expect(
      registerSchema.safeParse({ ...base, email: 'no-es-un-email' }).success,
    ).toBe(false);
  });

  it('rechaza contraseña corta (menos de 8)', () => {
    expect(registerSchema.safeParse({ ...base, password: 'A1' }).success).toBe(false);
  });

  it('rechaza contraseña sin números', () => {
    expect(
      registerSchema.safeParse({ ...base, password: 'sololetras' }).success,
    ).toBe(false);
  });

  it('rechaza contraseña sin letras', () => {
    expect(
      registerSchema.safeParse({ ...base, password: '12345678' }).success,
    ).toBe(false);
  });

  it('rechaza acceptTerms distinto de true', () => {
    expect(
      registerSchema.safeParse({ ...base, acceptTerms: false }).success,
    ).toBe(false);
  });
});

describe('loginSchema', () => {
  it('acepta email+password no vacío', () => {
    const r = loginSchema.safeParse({
      email: 'omar.rivas@example.com',
      password: 'cualquier',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza email vacío o inválido', () => {
    expect(loginSchema.safeParse({ email: '', password: 'x' }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email: 'no-es-email', password: 'x' }).success,
    ).toBe(false);
  });

  it('rechaza password vacío', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: '' }).success,
    ).toBe(false);
  });
});
