/**
 * Proveedor OpenAI-compatibles (ORDEN F2-2 punto 2).
 *
 * Implementa `AIProvider` sobre el endpoint estándar
 * `POST {baseUrl}/chat/completions` (OpenAI, Google Gemini endpoint compatible,
 * Mistral, Groq, DeepSeek, xAI, OpenRouter, Together, Ollama, servidores propios).
 *
 * Estrategia de salida estructurada:
 *  1. Llamada principal con function calling:
 *     - tools [{ type:'function', function:{ name, description, parameters: jsonSchema } }]
 *     - tool_choice { type:'function', function:{ name } }
 *     - max_tokens
 *     Lee `choices[0].message.tool_calls[0].function.arguments` (JSON.parse).
 *  2. Fallback (si el proveedor responde 400 por tools no soportados, o la
 *     respuesta trae tool_calls vacía): reintento UNA sola vez sin tools, con
 *     `response_format { type:'json_object' }` e una instrucción explícita de
 *     devolver solo un objeto JSON que cumpla el esquema; se lee
 *     `choices[0].message.content` (JSON.parse).
 *
 * Robustez:
 *  - timeout 60 s vía AbortController.
 *  - 429 → AIError RATE_LIMIT; 401/403 → CONFIG; resto y errores de red → AI_FAILED.
 *  - Nunca se expone la API key en mensajes de error (sin filtrar la clave).
 */
import { AIError } from './errors';
import type { AIProvider, GenerateArgs, GenerateResult } from './provider';

const TIMEOUT_MS = 60_000;
const TOOL_DESCRIPTION = 'Devuelve el resultado estructurado';

interface OpenAICompatOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  label?: string;
}

export interface OpenAICompatibleProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  label?: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly label: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(options: OpenAICompatOptions) {
    const base = options.baseUrl.trim().replace(/\/+$/g, '');
    if (!base) {
      throw new AIError(
        'Falta la URL base del proveedor. Configura un endpoint OpenAI-compatibles.',
        'CONFIG',
      );
    }
    this.baseUrl = base;
    this.apiKey = options.apiKey?.trim() || undefined;
    this.model = options.model.trim() || 'gpt-4o-mini';
    this.label = options.label ?? options.model;
  }

  private async request(
    payload: unknown,
    signal: AbortSignal,
  ): Promise<{ status: number; body: unknown }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError(
          'El proveedor de IA tardó demasiado en responder. Revisa la conexión e inténtalo de nuevo.',
          'AI_FAILED',
        );
      }
      throw new AIError(
        'No se pudo conectar con el proveedor de IA. Revisa la conexión e inténtalo de nuevo.',
        'AI_FAILED',
      );
    }

    let body: unknown = null;
    try {
      const text = await response.text();
      if (text) body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  private mapHttpError(status: number, body: unknown): AIError {
    const message = extractErrorMessage(body);

    if (status === 429) {
      return new AIError(
        'Se superó el límite de peticiones a la IA; reintenta en unos segundos.',
        'RATE_LIMIT',
      );
    }
    if (status === 401 || status === 403) {
      return new AIError(
        `Clave de API inválida o sin permisos para el proveedor (${status}).`,
        'CONFIG',
        { detail: [message ?? `HTTP ${status}`] },
      );
    }
    if (status === 400) {
      // El mensaje del proveedor puede dar contexto (p. ej. tools no soportadas).
      return new AIError(
        message || `El proveedor devolvió un error de solicitud (400).`,
        'AI_FAILED',
        { detail: [message || 'HTTP 400'] },
      );
    }
    return new AIError(
      `El proveedor de IA no pudo completar la generación (HTTP ${status}).`,
      'AI_FAILED',
      { detail: [message || `HTTP ${status}`] },
    );
  }

  async generate(args: GenerateArgs): Promise<GenerateResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const primary: ToolCallPayload = {
        model: this.model,
        messages: [
          { role: 'system', content: args.system },
          { role: 'user', content: args.user },
        ],
        max_tokens: args.maxTokens,
        tools: [
          {
            type: 'function',
            function: {
              name: args.toolName,
              description: TOOL_DESCRIPTION,
              parameters: args.jsonSchema,
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: args.toolName },
        },
      };

      const primaryRes = await this.request(primary, controller.signal);

      // Si el proveedor no soporta tools (400) → usar la ruta JSON (no es retry).
      if (primaryRes.status === 400) {
        return await this.jsonFallback(args, controller.signal);
      }
      if (primaryRes.status >= 400) {
        throw this.mapHttpError(primaryRes.status, primaryRes.body);
      }

      const toolCall = extractToolCall(primaryRes.body, args.toolName);
      if (toolCall) return { data: toolCall, model: this.model };

      // 200 pero sin tool_calls → reintento una vez con json_object.
      return await this.jsonFallback(args, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async jsonFallback(
    args: GenerateArgs,
    signal: AbortSignal,
  ): Promise<GenerateResult> {
    const schema = JSON.stringify(args.jsonSchema);
    const userContent = [
      args.user,
      '',
      'IMPORTANTE: Responde SOLO con un objeto JSON que cumpla este esquema.',
      'No incluyas explicaciones, comentarios ni marcas de código.',
      `Esquema: ${schema}`,
    ].join('\n');

    const payload: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: userContent },
      ],
      max_tokens: args.maxTokens,
      response_format: { type: 'json_object' },
    };

    const res = await this.request(payload, signal);
    if (res.status >= 400) {
      throw this.mapHttpError(res.status, res.body);
    }

    const content = extractContent(res.body);
    if (typeof content !== 'string' || content.trim() === '') {
      throw new AIError(
        'La IA devolvió una respuesta vacía. Inténtalo de nuevo.',
        'AI_FAILED',
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      throw new AIError(
        'La IA no devolvió el JSON esperado. Inténtalo de nuevo.',
        'AI_FAILED',
      );
    }
    return { data, model: this.model };
  }
}

type ToolCallPayload = Record<string, unknown>;

function extractToolCall(body: unknown, toolName: string): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as Record<string, unknown>;
  const choices = b.choices;
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const toolCalls = message?.tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return undefined;

  const call = toolCalls[0] as Record<string, unknown> | undefined;
  const fn = call?.function as Record<string, unknown> | undefined;
  const name = fn?.name;
  const argsRaw = fn?.arguments;
  if (typeof name !== 'string' || name !== toolName) return undefined;
  if (typeof argsRaw !== 'string') return undefined;
  try {
    return JSON.parse(argsRaw);
  } catch {
    return undefined;
  }
}

function extractContent(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const choices = b.choices;
  if (!Array.isArray(choices)) return null;
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  return typeof content === 'string' ? content : null;
}

function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const err = b.error as Record<string, unknown> | undefined;
  if (typeof err?.message === 'string') return err.message;
  if (typeof b.message === 'string') return b.message as string;
  return null;
}
