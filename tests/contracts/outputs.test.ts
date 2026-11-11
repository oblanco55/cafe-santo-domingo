import { describe, expect, it } from 'vitest';
import {
  baseOutput,
  carouselOutputFor,
  photoOutputSchema,
  videoOutputFor,
} from '@/lib/contracts';

/** Base de salida mínima válida. */
const base = {
  title: 'Vestidos de lino',
  concept: 'Colección artesanal de primavera',
  creative_summary: 'Un vestido colgando de una cuerda con fondo liso.',
  platform: 'instagram',
  aspect_ratio: '1:1',
  visual_style: 'Luminoso y minimalista',
  caption: 'Descubre nuestra colección de lino',
  cta: 'Compra ahora',
  hashtags: ['lino', 'moda'],
  assumptions: ['El usuario vende ropa de mujer'],
};

const sections = {
  preparation: 'Lavar y planchar el vestido antes de la sesión.',
  composition: {
    subject_position: 'Centrado',
    shot_type: 'Primer plano',
    angle: 'Frente',
    camera_height: 'Nivel de ojos',
    distance: '60 cm',
  },
  lighting: {
    main_light: 'Luz natural de ventana',
    fill_light: 'Cartón blanco como relleno',
    budget_alternative: 'Lámpara de escritorio con difusor de papel.',
  },
  background: 'Pared blanca lisa',
  capture_steps: ['Enfocar con el celular', 'Ajustar exposición', 'Tirar 20 fotos'],
  format_and_text: 'PNG 1080×1080, texto centrado',
  verification: ['Revisar nitidez', 'Comprobar color', 'Verificar textos'],
};

describe('baseOutput', () => {
  it('rechaza hashtags vacíos dentro del array', () => {
    const r = baseOutput.safeParse({ ...base, hashtags: ['ab', ''] });
    expect(r.success).toBe(false);
  });

  it('rechaza más de 10 hashtags', () => {
    const r = baseOutput.safeParse({
      ...base,
      hashtags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(r.success).toBe(false);
  });
});

describe('photoOutputSchema', () => {
  it('acepta una salida de foto completa', () => {
    expect(
      photoOutputSchema.safeParse({ ...base, sections }).success,
    ).toBe(true);
  });

  it('rechaza salida de foto incompleta (falta lighting.budget_alternative)', () => {
    const r = photoOutputSchema.safeParse({
      ...base,
      sections: {
        ...sections,
        lighting: {
          main_light: 'Luz natural',
          fill_light: 'Cartón blanco',
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rechaza capture_steps con menos de 3 pasos', () => {
    const r = photoOutputSchema.safeParse({
      ...base,
      sections: { ...sections, capture_steps: ['Paso 1', 'Paso 2'] },
    });
    expect(r.success).toBe(false);
  });
});

describe('carouselOutputFor', () => {
  it('acepta carrusel de 3 láminas con índices 1..3', () => {
    const schema = carouselOutputFor(3);
    const slides = [1, 2, 3].map((i) => ({
      index: i,
      purpose: `Paso ${i}`,
      framing: 'General',
      angle: 'Frente',
      lighting: 'Luz natural',
      background: 'Blanco',
      props: 'Ninguno',
      actions: 'Mostrar producto',
      overlay_text: `Texto ${i}`,
    }));
    expect(
      schema.safeParse({
        ...base,
        general_setup: { lighting: 'Luz natural', color: 'Blanco' },
        slides,
      }).success,
    ).toBe(true);
  });

  it('rechaza carrusel con 4 láminas cuando se pidieron 5', () => {
    const schema = carouselOutputFor(5);
    const slides = [1, 2, 3, 4].map((i) => ({
      index: i,
      purpose: `Paso ${i}`,
      framing: 'General',
      angle: 'Frente',
      lighting: 'Luz natural',
      background: 'Blanco',
      props: 'Ninguno',
      actions: 'Mostrar producto',
      overlay_text: `Texto ${i}`,
    }));
    const r = schema.safeParse({
      ...base,
      general_setup: { lighting: 'Luz natural', color: 'Blanco' },
      slides,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza índices no consecutivos', () => {
    const schema = carouselOutputFor(3);
    const slides = [1, 2, 3].map((i, idx) => ({
      index: idx + 2,
      purpose: `Paso ${i}`,
      framing: 'General',
      angle: 'Frente',
      lighting: 'Luz natural',
      background: 'Blanco',
      props: 'Ninguno',
      actions: 'Mostrar producto',
      overlay_text: `Texto ${i}`,
    }));
    expect(
      schema.safeParse({
        ...base,
        general_setup: { lighting: 'Luz natural', color: 'Blanco' },
        slides,
      }).success,
    ).toBe(false);
  });
});

describe('videoOutputFor', () => {
  it('acepta video de 30 s con última escena terminando en 30 s', () => {
    const schema = videoOutputFor(30);
    const scenes = [
      {
        index: 1,
        time_range: '0–10 s',
        shot: 'Plano general',
        action: 'Mostrar producto',
        narration: 'Un vistazo a la colección',
        on_screen_text: 'Colección 2026',
      },
      {
        index: 2,
        time_range: '10–20 s',
        shot: 'Primer plano',
        action: 'Detalle de la tela',
        narration: 'Lino 100% natural',
        on_screen_text: 'Lino 100%',
      },
      {
        index: 3,
        time_range: '20–30 s',
        shot: 'Cierre',
        action: 'Invitar a comprar',
        narration: 'Compra hoy',
        on_screen_text: 'Link en bio',
      },
    ];
    expect(
      schema.safeParse({ ...base, scenes }).success,
    ).toBe(true);
  });

  it('rechaza video de 30 s cuya última escena termina en 20 s', () => {
    const schema = videoOutputFor(30);
    const scenes = [
      {
        index: 1,
        time_range: '0–10 s',
        shot: 'Plano general',
        action: 'Mostrar',
        narration: 'Inicio',
        on_screen_text: 'A',
      },
      {
        index: 2,
        time_range: '10–15 s',
        shot: 'Primer plano',
        action: 'Detalle',
        narration: 'Detalle',
        on_screen_text: 'B',
      },
      {
        index: 3,
        time_range: '15–20 s',
        shot: 'Cierre',
        action: 'Despedida',
        narration: 'Adiós',
        on_screen_text: 'C',
      },
    ];
    const r = schema.safeParse({ ...base, scenes });
    expect(r.success).toBe(false);
  });
});
