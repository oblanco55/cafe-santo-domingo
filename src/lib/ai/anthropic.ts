import Anthropic from '@anthropic-ai/sdk';
import type { Message, Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages/messages';
import { AIError } from './errors';
import type { AIProvider, GenerateArgs, GenerateResult } from './provider';

const DEFAULT_MODEL = 'claude-sonnet-5';
const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;

function statusOf(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'string') return status;
  }
  return '';
}

/**
 * Proveedor Anthropic con salida estructurada forzada mediante herramientas.
 * Reglas de ORDEN T4a:
 * - timeout 60 s, maxRetries 1
 * - tool_choice {type:'tool', name} cuyo input_schema es el JSON Schema del contrato
 * - 429 → AIError RATE_LIMIT; resto → AIError AI_FAILED (sin datos sensibles)
 * - Nunca se registra la API key.
 */
export class AnthropicProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AIError(
        'Falta ANTHROPIC_API_KEY para usar el proveedor «anthropic».',
        'CONFIG',
      );
    }
    this.client = new Anthropic({
      apiKey: key,
      timeout: TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    });
    this.model = model ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
  }

  async generate(args: GenerateArgs): Promise<GenerateResult> {
    let response: Message;
    try {
      const tool: AnthropicTool = {
        name: args.toolName,
        description: 'Devuelve el resultado estructurado',
        input_schema: args.jsonSchema as AnthropicTool.InputSchema,
      };
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: args.maxTokens,
        system: args.system,
        messages: [{ role: 'user', content: args.user }],
        tools: [tool],
        tool_choice: { type: 'tool', name: args.toolName },
      });
    } catch (error) {
      const status = statusOf(error);
      if (status.startsWith('429')) {
        throw new AIError(
          'Se superó el límite de peticiones a la IA; reintenta en unos segundos.',
          'RATE_LIMIT',
        );
      }
      throw new AIError(
        'El proveedor de IA no pudo completar la generación. Revisa la conexión e inténtalo de nuevo.',
        'AI_FAILED',
      );
    }

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new AIError(
        'La IA devolvió una respuesta sin la estructura esperada. Inténtalo de nuevo.',
        'AI_FAILED',
      );
    }

    return { data: toolUse.input, model: this.model };
  }
}
