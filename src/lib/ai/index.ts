/**
 * Selección y resolución de proveedores de IA para Café Santo Domingo.
 * - Soporta "mock" (desarrollo gratuito/local sin costo).
 * - Soporta "fal" (Fal.ai para Face Swap / Avatar 3D y Video).
 * - Soporta "replicate" (Replicate para Face Swap / InstantID).
 * - Soporta "anthropic" / "openai_compatible" (generación de texto y guiones).
 */
import { AIError } from './errors';
import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
import { OpenAICompatibleProvider } from './openai-compatible';
import { FalAIProvider } from './fal';
import { ReplicateAIProvider } from './replicate';
import { decryptSecret } from '@/lib/crypto';
import { db } from '@/lib/db';
import type { AIProvider } from './provider';

export interface ProviderEntry {
  provider: AIProvider;
  label: string;
}

let _resolveCache: ProviderEntry[] | null = null;
export function __aiForTests(_v?: ProviderEntry[] | null) {
  if (arguments.length > 0) _resolveCache = _v as ProviderEntry[] | null;
  return _resolveCache;
}

export function getProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? 'mock').trim().toLowerCase();

  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AIError(
        'Falta ANTHROPIC_API_KEY. Configúrala para poder usar el proveedor «anthropic».',
        'CONFIG',
      );
    }
    return new AnthropicProvider();
  }

  return new MockProvider();
}

/**
 * Resuelve el proveedor para Avatares / Video de Café Santo Domingo.
 * Si FAL_KEY está configurada y AI_PROVIDER="fal" -> FalAIProvider.
 * Si REPLICATE_API_TOKEN está configurada y AI_PROVIDER="replicate" -> ReplicateAIProvider.
 * En cualquier otro caso -> MockProvider (gratuito, sin errores, local).
 */
export function getAvatarProvider(): {
  kind: 'fal' | 'replicate' | 'mock';
  fal?: FalAIProvider;
  replicate?: ReplicateAIProvider;
  mock: MockProvider;
} {
  const providerKind = (process.env.AI_PROVIDER ?? 'mock').trim().toLowerCase();

  if (providerKind === 'fal' && process.env.FAL_KEY) {
    return {
      kind: 'fal',
      fal: new FalAIProvider(),
      mock: new MockProvider(),
    };
  }

  if (providerKind === 'replicate' && process.env.REPLICATE_API_TOKEN) {
    return {
      kind: 'replicate',
      replicate: new ReplicateAIProvider(),
      mock: new MockProvider(),
    };
  }

  return {
    kind: 'mock',
    mock: new MockProvider(),
  };
}

/**
 * Carga proveedores habilitados desde la BD.
 */
export async function resolveProviders(): Promise<ProviderEntry[] | null> {
  if (_resolveCache !== null) return _resolveCache;
  let rows;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaClient = db as any;
    rows = await prismaClient.aIProvider.findMany({
      where: { enabled: true },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }, { createdAt: 'asc' }],
    });
  } catch {
    return null;
  }

  const out: ProviderEntry[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (rows || [])) {
    try {
      const apiKey = row.apiKeyEnc ? decryptSecret(row.apiKeyEnc) : undefined;
      let p: AIProvider;
      if (row.kind === 'anthropic') {
        p = new AnthropicProvider(apiKey, row.model);
      } else {
        if (!row.baseUrl) continue;
        p = new OpenAICompatibleProvider({
          baseUrl: row.baseUrl,
          apiKey,
          model: row.model,
          label: row.label,
        });
      }
      out.push({ provider: p, label: row.label || row.model });
    } catch {
      continue;
    }
  }
  _resolveCache = out;
  return out;
}

export async function getProviderChain(): Promise<AIProvider[]> {
  const fromDb = await resolveProviders();
  if (fromDb && fromDb.length > 0) {
    return fromDb.map((e) => e.provider);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return [new AnthropicProvider()];
    } catch {
      // Sigue el fallback a mock
    }
  }
  return [new MockProvider()];
}

export { AIError } from './errors';
export type { AIErrorCode } from './errors';
export type { AIProvider, GenerateArgs, GenerateResult } from './provider';
export { AnthropicProvider } from './anthropic';
export { MockProvider, buildMockOutput, buildMockAvatarSvg, buildMockAvatarOutput } from './mock';
export type { MockType, MockHint } from './mock';
export { OpenAICompatibleProvider } from './openai-compatible';
export { FalAIProvider } from './fal';
export type { FalAvatarOptions, FalAvatarResult } from './fal';
export { ReplicateAIProvider } from './replicate';
export { PROVIDER_PRESETS, presetById } from './presets';
export type { ProviderPreset } from './presets';
