/**
 * Tests del proveedor mock de Café Santo Domingo (ORDEN T4a).
 * Valida que `buildMockOutput` produzca salidas válidas para los tres
 * esquemas de salida:
 *  - photo (1:1 y 9:16) contra `photoOutputSchema`
 *  - carousel (3, 5, 7) contra `carouselOutputFor(slideCount)`
 *  - video (15, 30, 45) contra `videoOutputFor(duration)`
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  photoOutputSchema,
  carouselOutputFor,
  videoOutputFor,
} from '@/lib/contracts';
import { buildMockOutput } from '@/lib/ai';

function validateWith(schema: z.ZodType, data: unknown) {
  return schema.safeParse(data);
}

const BASE_INPUT = {
  countryIso: 'AR',
  offerType: 'product',
  sector: 'moda',
  sectorOther: undefined,
  description: 'Venta de ropa casual para hombre y mujer, con cortes modernizantes.',
  platform: 'instagram',
  objective: 'presentacion',
  equipment: 'celular',
  resources: ['luz_natural', 'fondo_liso'],
};

describe('buildMockOutput · photo (1:1)', () => {
  it('producir una salida válida para aspectRatio 1:1', () => {
    const result = validateWith(
      photoOutputSchema,
      buildMockOutput('photo', { ...BASE_INPUT, aspectRatio: '1:1' }),
    );
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues, null, 2)).toBe(true);
  });

  it('título por modalidad: "Guía de fotografía" (no "Guía de foto")', () => {
    const out = buildMockOutput('photo', { ...BASE_INPUT, aspectRatio: '1:1' }) as {
      title: string;
    };
    expect(out.title).toBe('Guía de fotografía: Moda');
  });

  it('creative_summary: omite la frase de estilo en ia_recomienda', () => {
    const out = buildMockOutput('photo', {
      ...BASE_INPUT,
      aspectRatio: '1:1',
      photoStyle: 'ia_recomienda',
    }) as { creative_summary: string };
    expect(out.creative_summary).not.toContain('con estilo');
    expect(out.creative_summary).not.toContain('ia_recomienda');
  });

  it('creative_summary: usa el label de PHOTO_STYLES cuando el estilo es explícito', () => {
    const out = buildMockOutput('photo', {
      ...BASE_INPUT,
      aspectRatio: '1:1',
      photoStyle: 'producto_solo',
    }) as { creative_summary: string };
    expect(out.creative_summary).toContain('con estilo Producto solo');
    expect(out.creative_summary).not.toContain('producto_solo');
  });

  it('contiene creative_summary, title y concept no vacíos', () => {
    const out = buildMockOutput('photo', { ...BASE_INPUT, aspectRatio: '1:1' }) as {
      title: string;
      concept: string;
      creative_summary: string;
    };
    expect(out.title).toBeTruthy();
    expect(out.title.trim().length).toBeGreaterThan(0);
    expect(out.concept).toBeTruthy();
    expect(out.concept.trim().length).toBeGreaterThan(0);
    expect(out.creative_summary).toBeTruthy();
    expect(out.creative_summary.trim().length).toBeGreaterThan(0);
  });
});

describe('buildMockOutput · carrusel y video · títulos (orden T10c)', () => {
  it('carrusel: título "Guía de carrusel: ..."', () => {
    const out = buildMockOutput('carousel', { ...BASE_INPUT, slideCount: 5 }) as {
      title: string;
    };
    expect(out.title).toBe('Guía de carrusel: Moda');
  });

  it('video: título "Guion de video: ..." (no "Guía de video")', () => {
    const out = buildMockOutput('video', { ...BASE_INPUT, duration: 30 }) as {
      title: string;
    };
    expect(out.title).toBe('Guion de video: Moda');
  });
});

describe('buildMockOutput · photo (9:16)', () => {
  it('produzir una salida válida para aspectRatio 9:16', () => {
    const result = validateWith(
      photoOutputSchema,
      buildMockOutput('photo', { ...BASE_INPUT, aspectRatio: '9:16' }),
    );
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues, null, 2)).toBe(true);
  });
});

describe('buildMockOutput · carousel', () => {
  it.each([3, 5, 7] as const)('produzir exactly %i slides válidas', (n) => {
    const schema = carouselOutputFor(n);
    const result = validateWith(
      schema,
      buildMockOutput('carousel', { ...BASE_INPUT, slideCount: n }),
    );
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues, null, 2)).toBe(true);
    if (result.success) {
      expect((result.data as { slides: unknown[] }).slides).toHaveLength(n);
    }
  });
});

describe('buildMockOutput · video', () => {
  it.each([15, 30, 45] as const)(
    'produzir una salida válida para duración %i segundos',
    (d) => {
      const schema = videoOutputFor(d);
      const result = validateWith(
        schema,
        buildMockOutput('video', { ...BASE_INPUT, duration: d }),
      );
      expect(result.success, result.success ? '' : JSON.stringify(result.error.issues, null, 2)).toBe(true);
    },
  );
});
