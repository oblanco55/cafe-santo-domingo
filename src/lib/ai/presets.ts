/**
 * Presets de proveedores de IA para Café Santo Domingo (ORDEN F2-2 punto 1).
 *
 * Cada preset describe un proveedor del mercado:
 *  - `anthropic` (nativo) → AnthropicProvider.
 *  - `openai_compatible` (function calling / JSON Schema) → OpenAICompatibleProvider.
 *
 * `defaultModel` es una sugerencia razonable; el admin puede editarla desde el
 * panel (F2-3/F2-4). `docsUrl` apunta a la documentación oficial del endpoint.
 *
 * Para `ollama` y `custom` la URL base es libre (servidores locales o propios).
 */
import type { AIProviderKind } from '@/generated/prisma/enums';

export interface ProviderPreset {
  id: string;
  label: string;
  kind: AIProviderKind;
  baseUrl: string;
  defaultModel: string;
  docsUrl: string;
  /** true cuando el admin necesita editar la URL base (servidor local o propio). */
  baseUrlEditable?: boolean;
}

export const OPENAI_BASE = 'https://api.openai.com/v1';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-5-5',
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai_compatible',
    baseUrl: OPENAI_BASE,
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'openai_compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    docsUrl: 'https://ai.google.dev/api/generate-content',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai_compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    docsUrl: 'https://docs.mistral.ai/api',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    docsUrl: 'https://console.groq.com/docs/api-endpoints',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai_compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    docsUrl: 'https://api-docs.deepseek.com',
  },
  {
    id: 'xai',
    label: 'xAI',
    kind: 'openai_compatible',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3',
    docsUrl: 'https://docs.x.ai/docs',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    kind: 'openai_compatible',
    baseUrl: 'https://api.minimax.io/v1',
    defaultModel: 'MiniMax-M2',
    docsUrl: 'https://platform.minimax.io/docs',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    docsUrl: 'https://openrouter.ai/docs',
  },
  {
    id: 'together',
    label: 'Together AI',
    kind: 'openai_compatible',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
    docsUrl: 'https://docs.together.ai/reference/chat',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'openai_compatible',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    docsUrl: 'https://docs.ollama.com/openai-compatibility',
    baseUrlEditable: true,
  },
  {
    id: 'custom',
    label: 'Personalizado (OpenAI-compatible)',
    kind: 'openai_compatible',
    baseUrl: '',
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://openai.com/guides/structured-outputs',
    baseUrlEditable: true,
  },
];

export function presetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
