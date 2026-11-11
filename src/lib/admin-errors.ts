/**
 * F2-3d — Errores de administración.
 *
 * Sustituye el uso de AIError para errores que no son de IA
 * (usuario no existe, recurso no encontrado, validación de admin).
 * Las rutas las mapean a HTTP 404 (no encontrado) o 400 (validación).
 */
export class AdminError extends Error {
  constructor(
    public readonly status: number = 400,
    public readonly code: string = 'VALIDATION',
    message: string = 'Datos de entrada inválidos',
  ) {
    super(message);
    this.name = 'AdminError';
  }
}
