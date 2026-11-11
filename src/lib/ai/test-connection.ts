/**
 * Diagnóstico de conexión de proveedores (ORDEN F2-2 punto 6).
 *
 * `testProvider(config)` hace una llamada mínima (system corto, schema `{ok:boolean}`)
 * contra el proveedor para verificar:
 *  - conectividad,
 *  - que la API key funcione,
 *  - que el modelo responda,
 * y reporta:
 *  - `ok` booleano,
 *  - `latencyMs` (medido desde el arranque de la llamada),
 *  - `model` (identificador del modelo usado),
 *  - `label` (nombre visible para el panel — opcional desde config),
 *  - `error?` (mensaje humano sin datos sensibles) cuando falla.
 *
 * No lanza errores: siempre resuelve con un objeto `{ok, ...}`.
 * El panel admin (F2-4) usa esto para probar un proveedor antes de guardarlo.
 */
import { AIError } from './errors';
import type { AIProvider, GenerateArgs } from './provider';

const TEST_TIMEOUT_MS = 30_000;

export interface TestProviderConfig {
  /** Proveedor a diagnosticar. */
  provider: AIProvider;
  /** Etiqueta legible para el panel (p. ej. "OpenAI", "Mi servidor local"). */
  label?: string;
}

export interface TestProviderResult {
  ok: boolean;
  latencyMs: number;
  model: string | null;
  providerLabel: string | null;
  error?: string;
}

/**
 * Realiza una llamada mínima `testConnection` contra `provider`.
 *
 * El schema mínimo `{ok: boolean}` es deliberado:
 *  - es lo bastante simple para que cualquier proveedor lo satisfaga,
 *  - permite detectar fallos reales (network, 401/403, 429, parseo)
 *    sin depender de una salida rica que podría fallar por formato.
 */
export async function testProvider(config: TestProviderConfig): Promise<TestProviderResult> {
  const { provider, label } = config;
  const startedAt = Date.now();

  const args: GenerateArgs = {
    system:
      'Eres un asistente de prueba del proveedor de IA. Responde SOLO llamando a la herramienta con un objeto JSON válido.',
    user: 'Prueba de conexión: devuelve ok=true.',
    toolName: 'test_connection',
    jsonSchema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    },
    maxTokens: 64,
  };

  try {
    // `Promise.race` contra un timeout de 30 s para no depender del timeout
    // interno del proveedor (que puede no estar definido).
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new AIError(
              'El proveedor tardó demasiado en responder. Inténtalo de nuevo.',
              'AI_FAILED',
            ),
          ),
        TEST_TIMEOUT_MS,
      );
    });
    const result = await Promise.race([provider.generate(args), timeout]);
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      model: result.model,
      providerLabel: label ?? null,
    };
  } catch (error) {
    const message =
      error instanceof AIError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'El proveedor no pudo completarse. Inténtalo de nuevo.';
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      model: null,
      providerLabel: label ?? null,
      error: message,
    };
  }
}
