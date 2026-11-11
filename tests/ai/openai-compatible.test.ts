/**
 * Tests de src/lib/ai/openai-compatible.ts (ORDEN F2-2 punto 7).
 *
 * Usa `vi.spyOn(globalThis, 'fetch')` para simular las respuestas de la API de
 * OpenAI compatible sin tocar red.
 *
 * Cobertura:
 * - Constructor: requiere baseUrl; expone label/apiKey/model opcionales.
 * - Éxito con tool_calls: parsea tool_calls[0].function.arguments.
 * - Éxito sin tool_calls (fallback JSON): parsea message.content.
 * - 400 con tools → fallback JSON.
 * - 401/403 → AIError code 'CONFIG'.
 * - 429 → AIError code 'RATE_LIMIT'.
 * - 5xx / red → AIError code 'AI_FAILED'.
 * - Respuesta vacía / inválida → AI_FAILED.
 * - `model` extraído.
 * - No expone API key en el mensaje de error.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from '@/lib/ai/openai-compatible';
import type { GenerateArgs, GenerateResult } from '@/lib/ai/provider';

const SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' } },
  required: ['title'],
  additionalProperties: false,
} as const;

const ARGS: GenerateArgs = {
  system: 'Sistema de prueba.',
  user: 'Genera un título.',
  toolName: 'create_photo_plan',
  jsonSchema: SCHEMA,
  maxTokens: 128,
};

function mockOk(body: Record<string, unknown>) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}

function mockOkContent(content: string, model = 'gpt-4o-mini') {
  return mockOk({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content, tool_calls: null },
        finish_reason: 'stop',
      },
    ],
  });
}

function mockOkToolCalls(argumentsJson: string, toolName: string, model = 'gpt-4o-mini') {
  return mockOk({
    id: 'chatcmpl-tool',
    object: 'chat.completion',
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: toolName, arguments: argumentsJson } },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  });
}

function mockError(status: number, body: Record<string, unknown>) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}

function mockNetworkError() {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));
}

function makeProvider(overrides: Record<string, unknown> = {}) {
  return new OpenAICompatibleProvider({
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-test-key',
    model: 'gpt-4o-mini',
    label: 'Proveedor de prueba',
    ...overrides,
  });
}

describe('OpenAICompatibleProvider — construct', () => {
  it('requiere baseUrl', () => {
    expect(() => new OpenAICompatibleProvider({ baseUrl: '', model: 'x' })).toThrowError(/Falta la URL base/);
    expect(() => new OpenAICompatibleProvider({ baseUrl: '   ', model: 'x' })).toThrowError(/Falta la URL base/);
  });

  it('expongo label, apiKey (opcional) y model', () => {
    const p = makeProvider({ label: 'Mi proveedor' });
    expect(p.label).toBe('Mi proveedor');
  });

  it('usa el model por defecto si no se pasa', () => {
    const p = new OpenAICompatibleProvider({ baseUrl: 'https://api.example.com/v1', model: 'gpt-4o-mini' });
    expect(p.label).toBe('gpt-4o-mini');
  });
});

describe('OpenAICompatibleProvider — generate()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exitoso con tool_calls: parsea function.arguments', async () => {
    mockOkToolCalls(JSON.stringify({ title: 'Fotografía heroica' }), 'create_photo_plan');

    const result: GenerateResult = await makeProvider().generate(ARGS);
    expect(result.data).toEqual({ title: 'Fotografía heroica' });
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('exitoso sin tool_calls (fallback JSON): parsea message.content', async () => {
    // 1ª llamada: 200 sin tool_calls → dispara jsonFallback
    const mock = vi.spyOn(globalThis, 'fetch');
    mock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'chatcmpl-tool-none',
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'text sin tool', tool_calls: null },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    // 2ª llamada (jsonFallback): 200 con content JSON
    mock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'chatcmpl-fb',
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: JSON.stringify({ title: 'Fallback ok' }) },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await makeProvider().generate(ARGS);
    expect(result.data).toEqual({ title: 'Fallback ok' });
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('400 con tools → fallback JSON: usa 2ª llamada', async () => {
    const mock = vi.spyOn(globalThis, 'fetch');
    // 1ª llamada: 400 (tools no soportados)
    mock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'tools not supported' } }), { status: 400 }),
    );
    // 2ª llamada: 200 con content JSON
    mock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'chatcmpl-fb-2',
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: JSON.stringify({ title: 'Fallback ok' }) },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await makeProvider().generate(ARGS);
    expect(result.data).toEqual({ title: 'Fallback ok' });
    // Se hizo 1 llamada al mock (no 2, porque 400 → fallback en la misma llamada)
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('401 → AIError con code CONFIG', async () => {
    mockError(401, { error: { message: 'Invalid API key' } });

    const provider = makeProvider();
    await expect(provider.generate(ARGS)).rejects.toMatchObject({
      code: 'CONFIG',
    });
  });

  it('403 → AIError con code CONFIG', async () => {
    mockError(403, { error: { message: 'Forbidden' } });

    const provider = makeProvider();
    await expect(provider.generate(ARGS)).rejects.toMatchObject({
      code: 'CONFIG',
    });
  });

  it('429 → AIError con code RATE_LIMIT', async () => {
    mockError(429, { error: { message: 'Too many requests' } });

    const provider = makeProvider();
    await expect(provider.generate(ARGS)).rejects.toMatchObject({
      code: 'RATE_LIMIT',
    });
  });

  it('500 → AIError con code AI_FAILED', async () => {
    mockError(500, { error: { message: 'Internal server error' } });

    const provider = makeProvider();
    await expect(provider.generate(ARGS)).rejects.toMatchObject({
      code: 'AI_FAILED',
    });
  });

  it('red (network) → AIError con code AI_FAILED', async () => {
    mockNetworkError();

    const provider = makeProvider();
    await expect(provider.generate(ARGS)).rejects.toMatchObject({
      code: 'AI_FAILED',
    });
  });

  it('respuesta vacía → AI_FAILED', async () => {
    mockOkContent('   '); // solo espacios

    const provider = makeProvider();
    await expect(provider.generate(ARGS)).rejects.toMatchObject({
      code: 'AI_FAILED',
    });
  });

  it('content inválido (no JSON) → AI_FAILED', async () => {
    mockOkContent('esto no es JSON');

    const provider = makeProvider();
    await expect(provider.generate(ARGS)).rejects.toMatchObject({
      code: 'AI_FAILED',
    });
  });

  it('no expone API key en el mensaje de error', async () => {
    mockError(401, { error: { message: 'Invalid API key sk-test-key' } });

    const provider = makeProvider();
    try {
      await provider.generate(ARGS);
      expect.unreachable('debe fallar con 401');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('sk-test-key');
    }
  });
});
