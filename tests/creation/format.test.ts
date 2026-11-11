import { describe, it, expect } from 'vitest';
import {
  guideToText,
  copyToText,
  platformLabel,
  aspectLabel,
  type CreationType,
} from '@/components/creation/format';
import { buildMockOutput } from '@/lib/ai/mock';

const BASE_INPUT = {
  countryIso: 'AR',
  offerType: 'product',
  sector: 'moda',
  sectorOther: undefined,
  description:
    'Venta de ropa casual para hombre y mujer, con cortes modernizantes.',
  platform: 'instagram',
  objective: 'presentacion',
  equipment: 'celular',
  resources: ['luz_natural', 'fondo_liso'],
};

/** Genera una salida de mock + la transforma con guideToText. */
function buildAndText(
  type: CreationType,
  overrides: Partial<typeof BASE_INPUT> = {},
) {
  const output = buildMockOutput(type, {
    ...BASE_INPUT,
    ...overrides,
    slideCount: type === 'carousel' ? 5 : undefined,
    aspectRatio: type === 'video' ? '16:9' : '1:1',
  });
  const text = guideToText(type, output);
  return { output, text };
}

describe('guideToText · photo', () => {
  it('contiene los 8 bloques numerados en orden', () => {
    const { text } = buildAndText('photo');
    const expectedBlocks = [
      ['1.', /1\.\s+Resumen creativo/i],
      ['2.', /2\.\s+Preparación/i],
      ['3.', /3\.\s+Composición/i],
      ['4.', /4\.\s+Iluminación/i],
      ['5.', /5\.\s+Fondo y ambientación/i],
      ['6.', /6\.\s+Captura/i],
      ['7.', /7\.\s+Formato y texto/i],
      ['8.', /8\.\s+Verificación/i],
    ];
    for (const [, re] of expectedBlocks) {
      expect(text).toMatch(re);
    }
  });

  it('no incluye caption, hashtags ni CTA', () => {
    const { output, text } = buildAndText('photo');
    const base = output as {
      caption: string;
      cta: string;
      hashtags: string[];
    };
    expect(base.caption).toBeTruthy();
    expect(text).not.toContain(base.caption);
    expect(text).not.toContain(base.cta);
    for (const tag of base.hashtags) {
      expect(text).not.toContain(tag);
    }
  });
});

describe('guideToText · carousel', () => {
  it('contiene una sección por lámina (5 para slideCount=5)', () => {
    const { output, text } = buildAndText('carousel');
    const o = output as { slides: { index: number; purpose: string }[] };
    expect(o.slides).toHaveLength(5);
    for (const s of o.slides) {
      expect(text).toContain(`Lámina ${s.index}`);
      expect(text).toContain(s.purpose);
    }
  });

  it('contiene la configuración general', () => {
    const { output, text } = buildAndText('carousel');
    const o = output as { general_setup: { lighting: string; color: string } };
    expect(text).toContain(o.general_setup.lighting);
    expect(text).toContain(o.general_setup.color);
  });

  it('no incluye caption ni CTA', () => {
    const { output, text } = buildAndText('carousel');
    const base = output as { caption: string; cta: string };
    expect(text).not.toContain(base.caption);
    expect(text).not.toContain(base.cta);
  });
});

describe('guideToText · video', () => {
  it('contiene las 4 escenas con narración y texto en pantalla', () => {
    const { output, text } = buildAndText('video');
    const o = output as {
      scenes: {
        index: number;
        time_range: string;
        narration: string;
        on_screen_text: string;
      }[];
    };
    expect(o.scenes.length).toBeGreaterThanOrEqual(4);
    for (const s of o.scenes) {
      expect(text).toContain(`${s.index}.`);
      expect(text).toContain(s.time_range);
      expect(text).toContain(s.narration);
      expect(text).toContain(s.on_screen_text);
    }
  });

  it('no incluye caption ni CTA', () => {
    const { output, text } = buildAndText('video');
    const base = output as { caption: string; cta: string };
    expect(text).not.toContain(base.caption);
    expect(text).not.toContain(base.cta);
  });
});

/* ---------------- copyToText · separación estricta ---------------- */

describe('copyToText · incluye SOLO caption + CTA + hashtags', () => {
  it.each([
    ['photo', '1:1' as const],
    ['carousel', '10:5' as const],
    ['video', '16:9' as const],
  ] as const)('%s: solo el bloque de publicación', (type, aspect) => {
    const output = buildMockOutput(type, {
      ...BASE_INPUT,
      aspectRatio: aspect,
      slideCount: type === 'carousel' ? 3 : undefined,
    });
    const base = output as {
      caption: string;
      cta: string;
      hashtags: string[];
      title: string;
      concept: string;
    };
    const copyText = copyToText(base);

    // Debe contener caption, CTA y todos los hashtags.
    expect(copyText).toContain(base.caption);
    expect(copyText).toContain(base.cta);
    for (const tag of base.hashtags) {
      expect(copyText).toContain(tag);
    }

    // NO debe contener title ni concept (guía, no copy).
    expect(copyText).not.toContain(base.title);
    expect(copyText).not.toContain(base.concept);

    // NO debe contener secciones específicas por tipo.
    if (type === 'photo') {
      const o = output as { creative_summary: string };
      expect(copyText).not.toContain(o.creative_summary);
    }
    if (type === 'carousel') {
      const o = output as { slides: { purpose: string }[] };
      for (const s of o.slides) {
        expect(copyText).not.toContain(s.purpose);
      }
    }
    if (type === 'video') {
      const o = output as { scenes: { narration: string }[] };
      for (const s of o.scenes) {
        expect(copyText).not.toContain(s.narration);
      }
    }
  });
});

/* ---------------- Etiquetas de plataforma y formato ---------------- */

describe('platformLabel / aspectLabel', () => {
  it('resuelve las plataformas conocidas', () => {
    expect(platformLabel('instagram')).toBe('Instagram');
    expect(platformLabel('tiktok')).toBe('TikTok');
    expect(platformLabel('youtube')).toBe('YouTube');
    // whatsapp devuelve el valor tal cual (no está en el catálogo)
    expect(platformLabel('whatsapp')).toBe('whatsapp');
  });

  it('resuelve el 1:1 como "Cuadrada" (label del catálogo)', () => {
    // El caso especial de YouTube 1:1 es responsabilidad de la UI, no de format.ts.
    expect(aspectLabel('1:1')).toBe('Cuadrada 1:1');
  });

  it('resuelve labels desconocidos como fallback', () => {
    expect(platformLabel('unknown-platform')).toBe('unknown-platform');
    expect(aspectLabel('9:9')).toBe('9:9');
  });
});

/* ---------------- Normalización y edge cases ---------------- */

describe('edge cases', () => {
  it('guideToText maneja ausencia de assumptions', () => {
    const output = buildMockOutput('photo', {
      ...BASE_INPUT,
      aspectRatio: '1:1',
    });
    // Remove assumptions to simulate an edge case.
    delete (output as Record<string, unknown>)['assumptions'];
    const text = guideToText('photo', output);
    expect(text).toContain('Resumen creativo');
    // Should not crash with "Supuestos" section
    expect(text).not.toContain('Supuestos y recomendaciones');
  });
});
