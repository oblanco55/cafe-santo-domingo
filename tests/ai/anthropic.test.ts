/**
 * Tests de src/lib/ai/anthropic.ts (ORDEN F2-2 punto 7).
 *
 * Mockea `@anthropic-ai/sdk` en `client.messages.create` para no tocar red.
 *
 * Cobertura:
 * - Constructor: requiere apiKey (o ANTHROPIC_API_KEY); si falta → AIError.
 * - Éxito: usa tool_use y devuelve { data, model }.
 * - 429 → AIError RATE_LIMIT.
 * - 401/5xx/network → AIError AI_FAILED.
 * - Respuesta sin tool_use → AIError AI_FAILED.
 * - `model` configurable por construct.
 * - No expone API key en el mensaje de error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class AnthropicClient {
      constructor(_options?: Record<string, unknown>) {}
      readonly messages: { create: (args: unknown) => Promise<unknown> } = {
        create: async (_args: unknown) => {
          throw new Error('mock placeholder: usa vi.spyOn().mockResolvedValue');
        },
      };
    },
  };
});

import { AnthropicProvider } from '@/lib/ai/anthropic';
import type { GenerateArgs } from '@/lib/ai/provider';

const ARGS: GenerateArgs = {
  system: 'Sistema de prueba.',
  user: 'Genera una respuesta.',
  toolName: 'test_tool',
  jsonSchema: {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  } as const,
  maxTokens: 128,
};

function makeToolUseResponse(input: Record<string, unknown>, model = 'claude-3-5-sonnet') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    content: [
      { type: 'text', text: 'ok' },
      { type: 'tool_use', id: 'toolu_1', name: 'test_tool', input },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 5, output_tokens: 3 },
  };
}

function makeNoToolUseResponse() {
  return {
    id: 'msg_no_tool',
    type: 'message',
    role: 'assistant',
    model: 'claude-3-5-sonnet',
    content: [{ type: 'text', text: 'sin tool_use' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 5, output_tokens: 2 },
  };
}

function errorWithStatus(status: string, message: string): Error {
  const err = new Error(message) as Error & { status?: string };
  err.status = status;
  return err;
}

function spyCreate(provider: AnthropicProvider) {
  const client = (
    provider as unknown as { client: { messages: { create: (a: unknown) => Promise<unknown> } } }
  ).client;
  const spy = vi.spyOn(client.messages, 'create');
  return spy as unknown as ReturnType<typeof vi.fn>;
}

describe('AnthropicProvider — construct', () => {
  const saved = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = saved as string | undefined;
    vi.restoreAllMocks();
  });

  it('sin apiKey → AIError CONSTRUCT', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new AnthropicProvider(undefined)).toThrowError(/Falta ANTHROPIC_API_KEY/);
  });

  it('usa ANTHROPIC_API_KEY como fallback', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env-key';
    expect(() => new AnthropicProvider()).not.toThrow();
  });

  it('apiKey explícito funciona', () => {
    const p = new AnthropicProvider('sk-ant-test', 'claude-3-5-sonnet');
    expect(p).toBeInstanceOf(AnthropicProvider);
  });
});

describe('AnthropicProvider — generate()', () => {
  const provider = new AnthropicProvider('sk-ant-test', 'claude-3-5-sonnet');

  beforeEach(() => {
    vi.restoreAllMocks();
    spyCreate(provider).mockImplementation(async () => {
      throw new Error('resetado por beforeEach: define mockImplementation por test');
    });
  });

  it('exitoso: usa tool_use y devuelve { data, model }', async () => {
    const spy = spyCreate(provider);
    spy.mockResolvedValueOnce(makeToolUseResponse({ ok: true }));

    const result = await provider.generate(ARGS);
    expect(result.data).toEqual({ ok: true });
    expect(result.model).toBe('claude-3-5-sonnet');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('429 → AIError code RATE_LIMIT', async () => {
    const spy = spyCreate(provider);
    spy.mockRejectedValueOnce(errorWithStatus('429', 'rate limit reached'));
    await expect(provider.generate(ARGS)).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  });

  it('401 → AIError code AI_FAILED', async () => {
    const spy = spyCreate(provider);
    spy.mockRejectedValueOnce(errorWithStatus('401', 'invalid key'));
    await expect(provider.generate(ARGS)).rejects.toMatchObject({ code: 'AI_FAILED' });
  });

  it('500 → AIError code AI_FAILED', async () => {
    const spy = spyCreate(provider);
    spy.mockRejectedValueOnce(errorWithStatus('500', 'internal server error'));
    await expect(provider.generate(ARGS)).rejects.toMatchObject({ code: 'AI_FAILED' });
  });

  it('red (network error) → AIError code AI_FAILED', async () => {
    const spy = spyCreate(provider);
    spy.mockRejectedValueOnce(new Error('fetch failed'));
    await expect(provider.generate(ARGS)).rejects.toMatchObject({ code: 'AI_FAILED' });
  });

  it('respuesta sin tool_use → AIError code AI_FAILED', async () => {
    const spy = spyCreate(provider);
    spy.mockResolvedValueOnce(makeNoToolUseResponse());
    await expect(provider.generate(ARGS)).rejects.toMatchObject({ code: 'AI_FAILED' });
  });

  it('no expone API key en el mensaje de error', async () => {
    const spy = spyCreate(provider);
    spy.mockRejectedValueOnce(errorWithStatus('500', 'server error with key sk-ant-test'));
    try {
      await provider.generate(ARGS);
      expect.unreachable('debe fallar con 500');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('sk-ant-test');
    }
  });
});
