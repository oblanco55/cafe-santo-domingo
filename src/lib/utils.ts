/**
 * Utilidades compartidas — F2-3d
 */
import type { AIError } from '@/lib/ai/errors';

/**
 * Genera un texto de error genérico a partir de AIError.
 *
 * Regla: nunca exponer el mensaje interno del proveedor ni detalles de la
 * implementación (URL, headers, token, etc.). Se devuelve un mensaje
 * amigable y estacionario para el cliente; los detalles solo se logean
 * server-side.
 */
export function aiErrorMessage(err: AIError | unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as AIError).code;
    switch (code as string) {
      case 'AI_FAILED':
        return 'El servicio de IA no pudo completar la operación. Inténtalo de nuevo en unos minutos.';
      case 'RATE_LIMIT':
        return 'Se alcanzó el límite de solicitudes. Espera unos segundos e inténtalo de nuevo.';
      case 'CONFIG':
        return 'Configuración de IA incompleta; contacta al administrador.';
      case 'VALIDATION':
        return 'Datos de entrada inválidos para el motor de IA.';
      default:
        break;
    }
  }
  return 'Error interno del servicio de IA.';
}

/**
 * Utilidad compartida para formatear errores de API de forma segura
 * y genérica para el cliente final.
 *
 * En producción (process.env.NODE_ENV === 'production') se garantiza que
 * el mensaje expuesto NO contiene:
 *   - stack trace,
 *   - rutas internas o nombres de variables,
 *   - credenciales (sk-xxx, Bearer xxx, x-api-key).
 *
 * Se devuelve un mensaje estacionario y amigable por código de error.
 */
export function safeApiError(err: unknown, statusCode: number): string {
  const isProd = process.env.NODE_ENV === 'production';
  const code = (err && typeof err === 'object' && 'code' in err)
    ? (err as { code?: string }).code
    : undefined;

  // En producción: mensajes fijos para cualquier error.
  if (isProd) {
    if (code === 'AI_FAILED' || statusCode === 502) {
      return 'El servicio de IA no pudo completar la solicitud.';
    }
    if (code === 'RATE_LIMIT' || statusCode === 429) {
      return 'Se alcanzó el límite de solicitudes.';
    }
    if (statusCode === 400) {
      return 'Solicitud inválida.';
    }
    if (statusCode >= 400 && statusCode < 500) {
      return 'Error de cliente: la solicitud no pudo procesarse.';
    }
    // default 5xx
    return 'Error interno del servicio.';
  }

  // En desarrollo: permitir detalles para depuración pero filtrar secretos.
  const msg = err instanceof Error ? err.message : 'Error inesperado.';
  // Heurística: si el mensaje contiene algo que parece una credencial,
  // se sustituye por un placeholder.
  const scrubbed = msg.replace(
    /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9_\-~+/=.]{16,}|x-api-key[:\s]+[A-Za-z0-9_-]{16,})/gi,
    '<redacted>',
  );
  return scrubbed;
}

/**
 * Máscara para secretos breves: muestra solo los últimos 4 caracteres.
 * Devuelve "••••" si el valor está vacío.
 */
export function maskSecret(value: string): string {
  if (!value) return '••••';
  if (value.length <= 4) return '••••' + value;
  return '••••' + value.slice(-4);
}
