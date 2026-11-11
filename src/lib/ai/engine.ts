/**
 * Motor de IA por modalidad (ORDEN T4 punto 3 / T4c).
 *
 * `generateCreation(type, rawInput, provider)`:
 *  1. Valida la entrada con el esquema de contrato T2 (lanza AIError
 *     VALIDATION con fieldErrors vía z.flattenError — zod v4).
 *  2. Resuelve el esquema de salida: photoOutputSchema /
 *     carouselOutputFor(slideCount) / videoOutputFor(duration).
 *     jsonSchema = z.toJSONSchema(outSchema, { target: 'draft-7', io: 'output',
 *     unrepresentable: 'any' }) para forzar la herramienta en el proveedor.
 *  3. user = wrapUserData(humanizeInput(type, input)) + instrucción final de llamada a la herramienta
 *     `entregar_resultado`.
 *  4. provider.generate (le pasa hint { type, input } para el mock); valida data
 *     contra outSchema; si falla → 1 reintento con los errores en el user;
 *     si vuelve a fallar → AIError AI_FAILED.
 *  5. Devuelve { output, model, input }.
 *
 * maxTokens (T4 punto 3): photo 4000; carousel 3000 + 700*slideCount;
 * video 4000. Mínimo 1024 por limitación del proveedor.
 */
import { z, flattenError } from 'zod';
import {
  carouselInputSchema,
  carouselOutputFor,
  photoInputSchema,
  photoOutputSchema,
  videoInputSchema,
  videoOutputFor,
} from '@/lib/contracts';
import type {
  CarouselInput,
  CarouselOutput,
  PhotoInput,
  PhotoOutput,
  VideoInput,
  VideoOutput,
} from '@/lib/contracts';
import { AIError } from './errors';
import { getProvider, getProviderChain } from './index';
import type { AIProvider, GenerateArgs, GenerateResult } from './provider';
import { AnthropicProvider } from './anthropic';
import { wrapUserData } from './prompts/common';
import { humanizeInput } from './humanize';
import { SYSTEM_PROMPT as PHOTO_SYSTEM_PROMPT } from './prompts/photo';
import { SYSTEM_PROMPT as CAROUSEL_SYSTEM_PROMPT } from './prompts/carousel';
import { SYSTEM_PROMPT as VIDEO_SYSTEM_PROMPT } from './prompts/video';
import { MockProvider, type MockHint } from './mock';

export type CreationType = 'video' | 'photo' | 'carousel';
export type CreationInput = VideoInput | PhotoInput | CarouselInput;
export type CreationOutput = PhotoOutput | CarouselOutput | VideoOutput;

/** Shape mínimo que necesita el motor para validar la salida del proveedor. */
export interface OutSchema {
  safeParse(data: unknown):
    | { success: true; data: unknown }
    | {
        success: false;
        error: { issues: Array<{ path: (string | number)[]; message: string }> };
      };
}

export interface CreationResult {
  output: CreationOutput;
  model: string;
  input: CreationInput;
  /**
   * F2-2: etiqueta del proveedor utilizado (p. ej. "Anthropic", "OpenAI-compatibles",
   * "Mock"). Útil para el panel, el log de auditoría y el aviso al usuario.
   */
  providerLabel?: string;
}

const TOOL_NAME = 'entregar_resultado';
const MIN_MAX_TOKENS = 1024;

function maxTokensFor(type: CreationType, input: CreationInput): number {
  const n =
    type === 'photo'
      ? 4000
      : type === 'carousel'
        ? 3000 + 700 * (input as CarouselInput).slideCount
        : 4000;
  return Math.max(MIN_MAX_TOKENS, n);
}

function inputSchemaFor(type: CreationType) {
  if (type === 'photo') return photoInputSchema;
  if (type === 'carousel') return carouselInputSchema;
  return videoInputSchema;
}

function validateInput(
  type: CreationType,
  rawInput: unknown,
): { success: true; data: CreationInput } | { success: false; error: z.ZodError } {
  const schema = inputSchemaFor(type);
  const result = schema.safeParse(rawInput ?? {});
  if (result.success) {
    return { success: true, data: result.data as CreationInput };
  }
  return {
    success: false,
    error: result.error as unknown as z.ZodError,
  };
}

function outSchemaFor(
  type: CreationType,
  input: CreationInput,
): OutSchema {
  const s =
    type === 'photo'
      ? photoOutputSchema
      : type === 'carousel'
        ? carouselOutputFor((input as CarouselInput).slideCount)
        : videoOutputFor((input as VideoInput).duration);
  return s as unknown as OutSchema;
}

function systemPromptFor(type: CreationType): string {
  if (type === 'photo') return PHOTO_SYSTEM_PROMPT;
  if (type === 'carousel') return CAROUSEL_SYSTEM_PROMPT;
  return VIDEO_SYSTEM_PROMPT;
}

/**
 * Resuelve la cadena de proveedores a usar para esta generación:
 *  - Si el llamador pasa provider explícito, lo usa como único.
 *  - Si no, se resuelve asíncronamente: BD (enabled) → env ANTHROPIC_API_KEY →
 *    MockProvider (último resort).
 *
 * El hint del mock se aplica solo si la cadena contiene MockProvider.
 */
async function resolveChain(
  provider: AIProvider | undefined,
  hint: MockHint,
): Promise<{ chain: Array<{ provider: AIProvider; label: string }> }> {
  if (provider) {
    if (provider instanceof MockProvider && hint) provider.setHint(hint);
    return { chain: [{ provider, label: provider instanceof MockProvider ? 'Mock' : 'custom' }] };
  }
  const chain = await getProviderChain();
  if (chain.length === 0) chain.push(new MockProvider());
  for (const p of chain) {
    if (p instanceof MockProvider) p.setHint(hint);
  }
  // instanceof estático (importado arriba): evita `await` dentro de .map().
  return {
    chain: chain.map((p, i) => ({
      provider: p,
      label:
        p instanceof MockProvider
          ? 'Mock'
          : p instanceof AnthropicProvider
            ? p['model'] || 'Anthropic'
            : (p as unknown as { label?: string }).label ?? `Proveedor ${i + 1}`,
    })),
  };
}

/**
 * Intenta la generación con la cadena: para cada proveedor, usa su generate()
 * y valida contra el esquema de salida. Si el proveedor lanza AIError
 * AI_FAILED / RATE_LIMIT / error de red, pasa al siguiente.
 *
 * Devuelve { result, providerLabel } con el primer proveedor que cumplió.
 * Si todos fallan, lanza el último AIError (o uno genérico).
 */
async function tryChain(
  chain: Array<{ provider: AIProvider; label: string }>,
  args: GenerateArgs,
  outSchema: OutSchema,
): Promise<{ result: GenerateResult; providerLabel: string }> {
  let lastError: unknown = null;
  for (const entry of chain) {
    try {
      const result = await entry.provider.generate(args);
      const parsed = outSchema.safeParse(result.data);
      if (parsed.success) {
        return { result, providerLabel: entry.label };
      }
      // Salida del proveedor no válida: se reintenta UNA vez contra el MISMO
      // proveedor con los errores agregados (sigue el contrato T4c).
      const issueList = parsed.error.issues
        .slice(0, 10)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      const retried = await entry.provider.generate({
        ...args,
        user: `${args.user}\n\nTu respuesta anterior no cumplió el esquema. Errores: ${issueList}`,
      });
      const second = outSchema.safeParse(retried.data);
      if (second.success) {
        return { result: retried, providerLabel: entry.label };
      }
      lastError = new AIError('No pudimos generar un resultado válido. Inténtalo de nuevo.', 'AI_FAILED');
      // No pasa al siguiente: el proveedor respondió pero su salida no
      // cumplió el contrato. Es un fallo de calidad, no de conectividad.
      throw lastError;
    } catch (error) {
      lastError = error;
      // Se salta al siguiente solo si es un AIError de conectividad/límite
      // (AI_FAILED / RATE_LIMIT / CONFIG / red). VALIDATION es del usuario.
      if (error instanceof AIError && (error.code === 'AI_FAILED' || error.code === 'RATE_LIMIT' || error.code === 'CONFIG')) {
        continue;
      }
      throw error;
    }
  }
  if (lastError instanceof AIError) throw lastError;
  throw new AIError(
    'El proveedor de IA no pudo completar la generación. Revisa la conexión e inténtalo de nuevo.',
    'AI_FAILED',
  );
}

export async function generateCreation(
  type: CreationType,
  rawInput: unknown,
  provider?: AIProvider,
): Promise<CreationResult> {
  const inputResult = validateInput(type, rawInput);
  if (!inputResult.success) {
    const { fieldErrors } = flattenError(inputResult.error);
    throw new AIError(
      'Revisa los datos marcados e inténtalo de nuevo.',
      'VALIDATION',
      fieldErrors as Record<string, string[]>,
    );
  }
  const input = inputResult.data;

  const outSchema = outSchemaFor(type, input);
  const jsonSchema = z.toJSONSchema(outSchema as unknown as z.ZodObject<z.ZodRawShape>, {
    target: 'draft-7',
    io: 'output',
    unrepresentable: 'any',
  });

  const finalInstruction = `\n\nDevuelve el resultado llamando a la herramienta ${TOOL_NAME}.`;
  const baseUser = wrapUserData(humanizeInput(type, input)) + finalInstruction;

  const args: GenerateArgs = {
    system: systemPromptFor(type),
    user: baseUser,
    toolName: TOOL_NAME,
    jsonSchema,
    maxTokens: maxTokensFor(type, input),
  };

  const { chain } = await resolveChain(provider, { type, input });
  const { result, providerLabel } = await tryChain(chain, args, outSchema);

  const narrow = (data: unknown) =>
    data as PhotoOutput | CarouselOutput | VideoOutput;

  return {
    output: narrow(result.data),
    model: result.model,
    input,
    providerLabel,
  };
}

export { AIError } from './errors';
export type { AIErrorCode } from './errors';
export type { AIProvider, GenerateArgs, GenerateResult } from './provider';
export { getProvider } from './index';
export { MockProvider, buildMockOutput } from './mock';
export type { MockType, MockHint } from './mock';
export { AnthropicProvider } from './anthropic';
