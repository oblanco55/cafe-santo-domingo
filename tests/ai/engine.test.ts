/**
 * Tests del motor generateCreation (ORDEN T4c — los 6 casos de T4 punto 4).
 * Usa proveedores falsos (objetos que implementan AIProvider) y el mock real.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { photoOutputSchema } from '@/lib/contracts/outputs';
import { MockProvider } from '@/lib/ai';
import { AIError } from '@/lib/ai/errors';
import { generateCreation } from '@/lib/ai/engine';
import type { AIProvider, GenerateArgs, GenerateResult } from '@/lib/ai/provider';

/** Entradas mínimas válidas de las tres modalidades. */
const photoInput = {
  countryIso: 'MX',
  offerType: 'product',
  sector: 'moda',
  description: 'Vendo vestidos de lino hechos a mano en pequeños lotes para mujer.',
  platform: 'instagram',
  objective: 'presentacion',
  aspectRatio: '1:1',
} as const;

const carouselInputBase = {
  countryIso: 'AR',
  offerType: 'product',
  sector: 'gastronomia',
  description: 'Catering para eventos sociales: entradas, platos fríos y repostería.',
  platform: 'facebook',
  objective: 'promocion',
  aspectRatio: '1:1',
} as const;

const videoInput = {
  countryIso: 'CO',
  offerType: 'service',
  sector: 'belleza',
  description: 'Salón de belleza con tintura, corte y peinado para dama en el centro.',
  platform: 'tiktok',
  objective: 'beneficio',
  duration: 30,
} as const;

/** Proveedor falso que devuelve respuestas fijas en orden. */
function fakeProvider(
  responses: Array<() => unknown> | unknown[],
  model = 'fake-1.0',
) {
  let call = 0;
  const calls: Array<{ args: GenerateArgs; result: { data: unknown; model: string } | Error }> =
    [];
  const provider: AIProvider = {
    async generate(args: GenerateArgs): Promise<GenerateResult> {
      const idx = Math.min(call, responses.length - 1);
      call += 1;
      const responseItem = responses[idx];
      const data =
        typeof responseItem === 'function'
          ? (responseItem as () => unknown)()
          : responseItem;
      calls.push({ args, result: { data, model } });
      return { data, model };
    },
  };
  return { provider, calls };
}

/** Construye una salida válida para un carrusel de n láminas. */
function validCarousel(n: number, overrides?: Record<string, unknown>) {
  const slide = (index: number) => ({
    index,
    purpose: `Fórmula ${index}`,
    framing: 'General',
    angle: 'Frente',
    lighting: 'Luz natural',
    background: 'Blanco',
    props: 'Ninguno',
    actions: 'Mostrar el producto',
    overlay_text: `Texto ${index}`,
  });
  return {
    title: 'Carrusel de ejemplo',
    concept: 'Concepto de prueba',
    creative_summary: 'Carrusel de 1:1 para plataforma de prueba, enfoque práctico.',
    platform: 'facebook',
    aspect_ratio: '1:1',
    visual_style: 'Limpio',
    caption: 'Copy de prueba',
    cta: 'Escríbenos',
    hashtags: ['marca'],
    assumptions: ['Supuesto de prueba'],
    general_setup: { lighting: 'Luz natural', color: 'Blanco' },
    slides: Array.from({ length: n }, (_, i) => slide(i + 1)),
    ...overrides,
  };
}

describe('generateCreation', () => {
  it('produce una salida válida para las 3 modalidades contra el mock real', async () => {
    // photo (1:1, 9:16)
    for (const aspectRatio of ['1:1', '9:16'] as const) {
      const r = await generateCreation(
        'photo',
        { ...photoInput, aspectRatio },
        new MockProvider(),
      );
      expect(
        schemaResult(photoOutputSchema, r.output, { aspect_ratio: aspectRatio }),
      ).toBe(true);
      expect(r.model).toBe('mock-1.0');
    }
    // photo (9:16)
    const rPhoto = await generateCreation(
      'photo',
      { ...photoInput, aspectRatio: '9:16' },
      new MockProvider(),
    );
    expect(photoOutputSchema.safeParse(rPhoto.output).success).toBe(true);

    // carousel (3, 5, 7)
    for (const n of [3, 5, 7] as const) {
      const r = await generateCreation(
        'carousel',
        { ...carouselInputBase, slideCount: n, carouselStructure: 'ia_recomienda' },
        new MockProvider(),
      );
      const parsed = (await import('@/lib/contracts/outputs')).carouselOutputFor(n).safeParse(
        r.output,
      );
      expect(
        parsed.success,
        parsed.success ? '' : JSON.stringify(parsed.error.issues),
      ).toBe(true);
    }

    // video (15, 30, 45)
    for (const d of [15, 30, 45] as const) {
      const r = await generateCreation(
        'video',
        { ...videoInput, duration: d },
        new MockProvider(),
      );
      const parsed = (await import('@/lib/contracts/outputs')).videoOutputFor(d).safeParse(
        r.output,
      );
      expect(
        parsed.success,
        parsed.success ? '' : JSON.stringify(parsed.error.issues),
      ).toBe(true);
    }
  });

  function schemaResult(
    schema: z.ZodType,
    data: unknown,
    extra: Record<string, unknown>,
  ): boolean {
    const r = schema.safeParse(data);
    if (!r.success) return false;
    return Object.entries(extra).every(
      ([k, v]) => (r.data as Record<string, unknown>)[k] === v,
    );
  }

  it('carrusel 5: si la 1ª salida trae 4 láminas, reintenta y la 2ª es válida', async () => {
    const { provider, calls } = fakeProvider([
      validCarousel(4), // 1ª inválida: 4 láminas cuando se piden 5
      validCarousel(5), // 2ª válida
    ]);
    const r = await generateCreation(
      'carousel',
      { ...carouselInputBase, slideCount: 5, carouselStructure: 'ia_recomienda' },
      provider,
    );
    expect(calls).toHaveLength(2);
    const { carouselOutputFor } = await import('@/lib/contracts/outputs');
    const parsed = carouselOutputFor(5).safeParse(r.output);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((r.output as unknown as { slides: unknown[] }).slides).toHaveLength(5);
    }
    // El reintento debe incluir el resumen de errores en el user
    expect(calls[0].args.user).toContain('entregar_resultado');
    expect(calls[1].args.user).toContain('Tu respuesta anterior no cumplió el esquema');
    expect(calls[1].args.user).toContain('Se esperaban exactamente 5 láminas');
    // Mismos parámetros base en ambas llamadas
    expect(calls[1].args.system).toBe(calls[0].args.system);
    expect(calls[1].args.maxTokens).toBe(3000 + 700 * 5);
  });

  it('lanzA AI_FAILED después de 2 salidas inválidAs', async () => {
    const { provider, calls } = fakeProvider([validCarousel(4), validCarousel(4)]);
    await expect(
      generateCreation(
        'carousel',
        { ...carouselInputBase, slideCount: 5, carouselStructure: 'ia_recomienda' },
        provider,
      ),
    ).rejects.toMatchObject({ name: 'AIError', code: 'AI_FAILED' });
    expect(calls).toHaveLength(2);
    // Los mensajes de error de validación deben estar en el reintento
    expect(calls[1].args.user).toContain(
      'Tu respuesta anterior no cumplió el esquema. Errores:',
    );
  });

  it('con input inválido lanza VALIDATION con fieldErrors (sin llamar al proveedor)', async () => {
    const { provider } = fakeProvider([{}]);
    try {
      await generateCreation(
        'photo',
        { ...photoInput, description: 'corto' },
        provider,
      );
      expect.unreachable('debería haber lanzado AIError');
    } catch (e) {
      expect(e).toBeInstanceOf(AIError);
      const err = e as AIError;
      expect(err.code).toBe('VALIDATION');
      expect(err.fieldErrors).toBeTruthy();
      expect(
        Object.keys(err.fieldErrors ?? {}).some((f) => f.includes('description')),
      ).toBe(true);
    }
  });

  it('el user prompt contiene <datos_usuario> con los datos serializados', async () => {
    const { provider, calls } = fakeProvider([validCarousel(3)]);
    const input = {
      ...carouselInputBase,
      slideCount: 3,
      carouselStructure: 'ia_recomienda',
    };
    await generateCreation('carousel', input, provider);
    expect(calls).toHaveLength(1);
    const user = calls[0].args.user;
    expect(user).toContain('<datos_usuario>');
    expect(user).toContain('</datos_usuario>');
    expect(user).toContain('Catering para eventos sociales');
    expect(user).toContain('"numero_de_laminas": 3');
    expect(user).not.toContain('ia_recomienda');
    expect(user).toContain('Devuelve el resultado llamando a la herramienta entregar_resultado.');
    expect(calls[0].args.toolName).toBe('entregar_resultado');
    // El jsonSchema es válido para el carrusel de 3 láminas
    const { carouselOutputFor } = await import('@/lib/contracts/outputs');
    expect(
      carouselOutputFor(3).safeParse(calls[0].args.jsonSchema).success,
    ).toBe(false); // jsonSchema describe la forma (no contiene datos) → no debe parsear
    expect(JSON.stringify(calls[0].args.jsonSchema)).toContain('slides');
  });

  it('el provider falso de Anthropic no se toca (sin API key): prueba por error de configuración', async () => {
    const { AIError: AE } = await import('@/lib/ai/errors');
    await expect(async () => {
      process.env.AI_PROVIDER = 'anthropic';
      delete process.env.ANTHROPIC_API_KEY;
      const { getProvider } = await import('@/lib/ai/index');
      getProvider();
    }).rejects.toThrow(AE);
  });
});
