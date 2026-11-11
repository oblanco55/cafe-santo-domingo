import { afterEach, describe, expect, it } from 'vitest';
import { isAdminEmail, resolveRegisterRole } from '@/lib/admin-emails';

/**
 * Tests de src/lib/admin-emails.ts (Fase 2).
 *
 * La variable ADMIN_EMAILS es una lista separada por comas, comparada
 * insensiblemente a mayúsculas y espacios. Vacío / no definida → nadie.
 */

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

describe('isAdminEmail', () => {
  it('es admin si el correo está en la lista (sin importar mayúsculas ni espacios)', () => {
    process.env.ADMIN_EMAILS = ' admin@x.com ,otro@x.com';
    expect(isAdminEmail('admin@x.com')).toBe(true);
    expect(isAdminEmail('ADMIN@X.COM')).toBe(true);
    expect(isAdminEmail('  admin@x.com  ')).toBe(true);
    expect(isAdminEmail('otro@x.com')).toBe(true);
  });

  it('no es admin si el correo no está en la lista', () => {
    process.env.ADMIN_EMAILS = 'admin@x.com,otro@x.com';
    expect(isAdminEmail('robo@x.com')).toBe(false);
    expect(isAdminEmail('admin')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it('lista vacía → nadie es admin', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAdminEmail('admin@x.com')).toBe(false);
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail('admin@x.com')).toBe(false);
  });

  it('lista con blancos y comas sueltas: se ignoran entradas vacías', () => {
    process.env.ADMIN_EMAILS = 'a@x.com,,b@x.com, ,  ';
    expect(isAdminEmail('a@x.com')).toBe(true);
    expect(isAdminEmail('b@x.com')).toBe(true);
    expect(isAdminEmail('@x.com')).toBe(false);
  });
});

describe('resolveRegisterRole', () => {
  it('devuelve "admin" si el correo está en ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'owner@company.com';
    expect(resolveRegisterRole('owner@company.com')).toBe('admin');
    expect(resolveRegisterRole('OTHER@company.com')).toBe('user');
  });

  it('devuelve "user" por defecto', () => {
    process.env.ADMIN_EMAILS = '';
    delete process.env.ADMIN_EMAILS;
    expect(resolveRegisterRole('anyone@example.com')).toBe('user');
  });
});
