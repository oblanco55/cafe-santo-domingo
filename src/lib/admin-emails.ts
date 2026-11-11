/**
 * Cuentas administradoras por lista de envíos.
 *
 * ADMIN_EMAILS: lista separada por comas de correos que deben tener role=admin.
 * - Comparación insensible a mayúsculas/minúsculas y espacios.
 * - Vacío / no definido → nadie es admin automáticamente.
 *
 * Se lee en cada llamada (no cacheada) para que los cambios de entorno
 * se apliquen sin reiniciar.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const raw = process.env.ADMIN_EMAILS;
  if (!raw || raw.trim() === '') return false;

  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  return list.includes(normalized);
}

/**
 * Devuelve el role a asignar al registrar un usuario: 'admin' si el correo
 * está en ADMIN_EMAILS, 'user' en caso contrario.
 */
export function resolveRegisterRole(email: string): 'admin' | 'user' {
  return isAdminEmail(email) ? 'admin' : 'user';
}
