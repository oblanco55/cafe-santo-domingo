/**
 * Tests de la entrada legible para la IA y de las reglas de calidad de
 * los prompts (ORDEN F2-2c).
 */
import { describe, expect, it } from 'vitest';
import { generateCreation, MockProvider } from '@/lib/ai/engine';
import { AI_CHOOSES, humanizeInput } from '@/lib/ai/humanize';
import type { GenerateArgs } from '@/lib/ai/provider';
import { SYSTEM_PROMPT as PHOTO_PROMPT } from '@/lib/ai/prompts/photo';
import { SYSTEM_PROMPT as CAROUSEL_PROMPT } from '@/lib/ai/prompts/carousel';
import { SYSTEM_PROMPT as VIDEO_PROMPT } from '@/lib/ai/prompts/video';
import type { PhotoInput } from '@/lib/contracts';
import { GOLDEN_INPUTS } from './fixtures/golden-inputs';

const photoInput = {
  countryIso: 'DO',
  offerType: 'service',
  sector: 'servicios_profesionales',
  description: 'Asesoría contable para pequeños negocios en Santiago de los Caballeros.',
  platform: 'instagram',
  objective: 'promocion',
  equipment: 'celular',
  resources: ['escritorio'],
  aspectRatio: '9:16',
  photoStyle: 'ia_recomienda',
} as PhotoInput;

describe('humanizeInput', () => {
  it('traduce los códigos a etiquetas en español', () => {
    const h = humanizeInput('photo', photoInput);
    expect(h.pais).toBe('República Dominicana');
    expect(h.que_promociona).toBe('Servicio');
    expect(h.sector).toBe('Servicios profesionales');
    expect(h.plataforma).toBe('Instagram');
    expect(h.objetivo).toBe('Promoción');
    expect(h.recursos).toEqual(['Escritorio']);
    expect(h.formato).toBe('Vertical Story 9:16 (1080×1920)');
  });

  it('ia_recomienda se convierte en la frase de elección', () => {
    expect(humanizeInput('photo', photoInput).tipo_de_foto).toBe(AI_CHOOSES);
  });

  it('sector «otro» usa el texto libre y sin recursos indica «Ninguno indicado»', () => {
    const h = humanizeInput('photo', {
      ...photoInput,
      sector: 'otro',
      sectorOther: 'Veterinaria',
      resources: ['ninguno'],
      equipment: undefined,
    });
    expect(h.sector).toBe('Veterinaria');
    expect(h.recursos).toBe('Ninguno indicado');
    expect(h.equipo).toBe('No indicado');
  });

  it('el mensaje enviado al proveedor no contiene códigos internos', async () => {
    const mock = new MockProvider();
    const calls: GenerateArgs[] = [];
    const provider = {
      generate: (args: GenerateArgs) => {
        calls.push(args);
        return mock.generate(args);
      },
    };
    mock.setHint({ type: 'photo', input: photoInput });
    await generateCreation('photo', photoInput, provider);
    const user = calls[0].user;
    expect(user).toContain('República Dominicana');
    expect(user).not.toContain('servicios_profesionales');
    expect(user).not.toContain('ia_recomienda');
  });

  it('los 6 casos del banco de evaluación son entradas válidas', async () => {
    expect(GOLDEN_INPUTS).toHaveLength(6);
    for (const c of GOLDEN_INPUTS) {
      await expect(generateCreation(c.type, c.input, new MockProvider())).resolves.toBeTruthy();
    }
  });
});

describe('reglas de calidad en los prompts', () => {
  it('incluyen las reglas de copy por plataforma', () => {
    for (const p of [PHOTO_PROMPT, CAROUSEL_PROMPT, VIDEO_PROMPT]) {
      expect(p).toContain('COPY POR PLATAFORMA');
      for (const red of ['Instagram:', 'Facebook:', 'TikTok:', 'YouTube:']) expect(p).toContain(red);
    }
  });

  it('la promoción usa el marcador y nunca se inventa', () => {
    expect(PHOTO_PROMPT).toContain('[indica aquí tu promoción y vigencia]');
    expect(PHOTO_PROMPT).toContain('NUNCA inventes la oferta');
  });

  it('el carrusel pide transición entre láminas y el video sugerencia de audio', () => {
    expect(CAROUSEL_PROMPT).toContain('transición hacia la siguiente lámina');
    expect(VIDEO_PROMPT).toContain('sin nombrar canciones con derechos');
  });
});
