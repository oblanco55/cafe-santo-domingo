/**
 * Tests de los prompts de sistema por modalidad (ORDEN T4b).
 * Verifica que cada SYSTEM_PROMPT contenga las reglas clave y que
 * wrapUserData envuelva correctamente el JSON del usuario.
 */
import { describe, expect, it } from 'vitest';
import { COMMON_RULES, wrapUserData } from '@/lib/ai/prompts/common';
import { SYSTEM_PROMPT as PHOTO_PROMPT } from '@/lib/ai/prompts/photo';
import { SYSTEM_PROMPT as CAROUSEL_PROMPT } from '@/lib/ai/prompts/carousel';
import { SYSTEM_PROMPT as VIDEO_PROMPT } from '@/lib/ai/prompts/video';

describe('common.ts', () => {
  it('COMMON_RULES contiene la regla de datos no confiables', () => {
    expect(COMMON_RULES).toContain('NO confiable');
  });

  it('COMMON_RULES contiene la regla de no inventar (case-insensitive)', () => {
    expect(COMMON_RULES.toLowerCase()).toContain('no inventes');
  });

  it('COMMON_RULES referencia la etiqueta de datos usuario', () => {
    expect(COMMON_RULES).toContain('<datos_usuario>');
  });

  it('wrapUserData envuelve el JSON entre los tags', () => {
    const input = { sector: 'moda', description: 'Zapatos de piel' };
    const result = wrapUserData(input);
    expect(result).toContain('<datos_usuario>');
    expect(result).toContain('</datos_usuario>');
    expect(result).toContain('moda');
    expect(result.startsWith('<datos_usuario>')).toBe(true);
    // El JSON formateado aparece íntegro
    expect(result).toContain(JSON.stringify(input, null, 2));
  });
});

describe('photo.ts', () => {
  it('contiene <datos_usuario>', () => {
    expect(PHOTO_PROMPT).toContain('<datos_usuario>');
  });

  it('contiene la regla "NO confiable"', () => {
    expect(PHOTO_PROMPT).toContain('NO confiable');
  });

  it('contiene la regla "no inventes" (case-insensitive)', () => {
    expect(PHOTO_PROMPT.toLowerCase()).toContain('no inventes');
  });

  it('menciona "UNa sola" toma', () => {
    expect(PHOTO_PROMPT.toUpperCase()).toContain('UNA SOLA');
  });
});

describe('carousel.ts', () => {
  it('contiene <datos_usuario>', () => {
    expect(CAROUSEL_PROMPT).toContain('<datos_usuario>');
  });

  it('contiene la regla "NO confiable"', () => {
    expect(CAROUSEL_PROMPT).toContain('NO confiable');
  });

  it('contiene la regla "no inventes" (case-insensitive)', () => {
    expect(CAROUSEL_PROMPT.toLowerCase()).toContain('no inventes');
  });

  it('menciona "exactamente" el número de láminas', () => {
    expect(CAROUSEL_PROMPT).toContain('exactamente');
  });
});

describe('video.ts', () => {
  it('contiene <datos_usuario>', () => {
    expect(VIDEO_PROMPT).toContain('<datos_usuario>');
  });

  it('contiene la regla "NO confiable"', () => {
    expect(VIDEO_PROMPT).toContain('NO confiable');
  });

  it('contiene la regla "no inventes" (case-insensitive)', () => {
    expect(VIDEO_PROMPT.toLowerCase()).toContain('no inventes');
  });

  it('menciona "segundos" para la duración', () => {
    expect(VIDEO_PROMPT).toContain('segundos');
  });
});
