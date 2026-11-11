import { describe, expect, it } from 'vitest';
import {
  carouselInputSchema,
  photoInputSchema,
  videoInputSchema,
} from '@/lib/contracts';

/** Fixture mínima válida para los campos comunes. */
const base = {
  countryIso: 'MX',
  offerType: 'product',
  sector: 'moda',
  description: 'Vendo vestidos de lino hechos a mano en pequeños lotes.',
  platform: 'instagram',
  objective: 'promocion',
  equipment: 'celular',
  resources: ['luz_natural'],
};

describe('commonInputSchema (video)', () => {
  it('acepta una entrada válida', () => {
    expect(videoInputSchema.safeParse({ ...base, duration: 30 }).success)
      .toBe(true);
  });

  it('rechaza sector "otro" sin sectorOther', () => {
    const r = videoInputSchema.safeParse({
      ...base,
      sector: 'otro',
      duration: 30,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          i.path.some((p) => p === 'sectorOther'),
        ),
      ).toBe(true);
    }
  });

  it('acepta sector "otro" con sectorOther válido', () => {
    expect(
      videoInputSchema.safeParse({
        ...base,
        sector: 'otro',
        sectorOther: 'Venta de velas aromáticas',
        duration: 30,
      }).success,
    ).toBe(true);
  });

  it('rechaza descripción corta (menos de 20 chars)', () => {
    expect(
      videoInputSchema.safeParse({
        ...base,
        description: 'Vendo vestidos.',
        duration: 30,
      }).success,
    ).toBe(false);
  });

  it('rechaza recursos con "ninguno" combinado con otros', () => {
    expect(
      videoInputSchema.safeParse({
        ...base,
        resources: ['ninguno', 'luz_natural'],
        duration: 30,
      }).success,
    ).toBe(false);
  });

  it('rechaza resources con duplicados', () => {
    expect(
      videoInputSchema.safeParse({
        ...base,
        resources: ['lampara', 'lampara'],
        duration: 30,
      }).success,
    ).toBe(false);
  });

  it('rechaza countryIso fuera del catálogo', () => {
    expect(
      videoInputSchema.safeParse({
        ...base,
        countryIso: 'XX',
        duration: 30,
      }).success,
    ).toBe(false);
  });

  it('aplica default objective: presentacion', () => {
    const { objective: _, ...rest } = base;
    const r = videoInputSchema.parse({ ...rest, duration: 15 });
    expect(r.objective).toBe('presentacion');
  });
});

describe('photoInputSchema', () => {
  it('acepta entrada válida con aspectRatio 1:1', () => {
    expect(
      photoInputSchema.safeParse({
        ...base,
        aspectRatio: '1:1',
      }).success,
    ).toBe(true);
  });

  it('rechaza aspectRatio 4:5 (fuera de catálogo)', () => {
    const r = photoInputSchema.safeParse({
      ...base,
      aspectRatio: '4:5',
    });
    expect(r.success).toBe(false);
  });

  it('aplica default photoStyle: ia_recomienda', () => {
    const r = photoInputSchema.parse({ ...base, aspectRatio: '9:16' });
    expect(r.photoStyle).toBe('ia_recomienda');
  });
});

describe('carouselInputSchema', () => {
  it('acepta entrada válida con slideCount 5', () => {
    expect(
      carouselInputSchema.safeParse({
        ...base,
        slideCount: 5,
        aspectRatio: '9:16',
      }).success,
    ).toBe(true);
  });

  it('rechaza slideCount 4 (fuera de catálogo)', () => {
    const r = carouselInputSchema.safeParse({
      ...base,
      slideCount: 4,
      aspectRatio: '1:1',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza aspectRatio 4:5', () => {
    expect(
      carouselInputSchema.safeParse({
        ...base,
        slideCount: 3,
        aspectRatio: '4:5',
      }).success,
    ).toBe(false);
  });

  it('aplica default carouselStructure: ia_recomienda', () => {
    const r = carouselInputSchema.parse({
      ...base,
      slideCount: 7,
      aspectRatio: '1:1',
    });
    expect(r.carouselStructure).toBe('ia_recomienda');
  });
});
