/**
 * Esquemas de SALIDA de las tres modalidades (lo que devuelve la IA).
 * zod v4, mensajes de error en español. Sin lógica de negocio:
 * solo validación de la estructura devuelta por el motor de IA.
 */
import { z } from 'zod';
import { ASPECT_RATIOS, PLATFORMS, type SlideCount, type VideoDuration } from './catalogs';

const text = (name: string, min = 1) =>
  z.string().trim().min(min, `«${name}» no puede estar vacío.`);

const hashtags = z
  .array(z.string().trim().min(1, 'Un hashtag no puede estar vacío.'))
  .max(10, 'Máximo 10 hashtags.')
  .default([]);

const assumptions = z
  .array(z.string().trim().min(1, 'Un supuesto no puede estar vacío.'))
  .default([]);

/** Base común a las tres salidas. */
const baseOutput = z.object({
  title: text('Título'),
  concept: text('Concepto general'),
  creative_summary: text('Resumen creativo'),
  platform: z.enum(Object.keys(PLATFORMS) as [string, ...string[]]),
  aspect_ratio: z.enum(Object.keys(ASPECT_RATIOS) as [string, ...string[]]),
  visual_style: text('Estilo visual'),
  caption: text('Texto para la publicación'),
  cta: text('Llamada a la acción'),
  hashtags,
  assumptions,
});

/** Salida del módulo de FOTOGRAFÍA ESTÁTICA. */
const photoOutputSchema = baseOutput.extend({
  sections: z.object({
    preparation: text('Preparación'),
    composition: z.object({
      subject_position: text('Posición del sujeto'),
      shot_type: text('Tipo de toma'),
      angle: text('Ángulo'),
      camera_height: text('Altura de cámara'),
      distance: text('Distancia a la sujeto'),
    }),
    lighting: z.object({
      main_light: text('Luz principal'),
      fill_light: text('Luz de relleno'),
      background_light: text('Luz de fondo').optional(),
      budget_alternative: text('Alternativa de bajo costo'),
    }),
    background: text('Fondo'),
    capture_steps: z
      .array(text('Paso de captura'))
      .min(3, 'Se requieren al menos 3 pasos de captura.'),
    format_and_text: text('Formato y textos'),
    verification: z
      .array(text('Verificación'))
      .min(3, 'Se requieren al menos 3 verificaciones.'),
  }),
});

/** Lámina de un carrusel. */
const slideSchema = z.object({
  index: z.number().int().min(1, 'El índice de lámina debe ser ≥ 1.'),
  purpose: text('Función narrativa'),
  framing: text('Encuadre'),
  angle: text('Ángulo'),
  lighting: text('Iluminación'),
  background: text('Fondo'),
  props: text('Accesorios'),
  actions: text('Acciones'),
  overlay_text: text('Texto sobre la imagen'),
});

/**
 * Construye el esquema de salida de carrusel para un número de láminas.
 * Exige slides.length === slideCount e índices 1..n consecutivos.
 */
function carouselOutputFor(slideCount: SlideCount) {
  return baseOutput.extend({
    general_setup: z.object({
      lighting: text('Iluminación común'),
      color: text('Paleta de color'),
    }),
    slides: z
      .array(slideSchema)
      .length(slideCount, `Se esperaban exactamente ${slideCount} láminas.`)
      .superRefine((slides, ctx) => {
        slides.forEach((s, i) => {
          if (s.index !== i + 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [i, 'index'],
              message: `El índice de la lámina ${i + 1} debe ser ${i + 1} (índices 1..${slideCount} consecutivos).`,
            });
          }
        });
      }),
  });
}

export type CarouselOutputSchema<_S extends SlideCount> = ReturnType<typeof carouselOutputFor>;

/** Escena de un video. */
const sceneSchema = z.object({
  index: z.number().int().min(1, 'El índice de escena debe ser ≥ 1.'),
  time_range: z
    .string()
    .trim()
    .min(1, 'El rango de tiempo no puede estar vacío.')
    .describe('Rango de tiempo como "0–3 s"'),
  shot: text('Toma'),
  action: text('Acción'),
  narration: text('Narración'),
  on_screen_text: text('Texto en pantalla'),
});

/**
 * Construye el esquema de salida de video para una duración en segundos.
 * Última escena debe terminar exactamente en la duración elegida.
 */
function videoOutputFor(duration: VideoDuration) {
  return baseOutput.extend({
    scenes: z
      .array(sceneSchema)
      .min(3, `Se requieren al menos 3 escenas para un video de ${duration} s.`)
      .superRefine((scenes, ctx) => {
        // Verifica orden de escenas e índice consecutivo
        scenes.forEach((s, i) => {
          if (s.index !== i + 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [i, 'index'],
              message: `El índice de la escena ${i + 1} debe ser ${i + 1}.`,
            });
          }
        });
        // Última escena debe terminar en duración elegida
        const last = scenes[scenes.length - 1];
        if (last) {
          const match = last.time_range.match(/(\d+)[–-]?\s*s/i);
          if (match) {
            const endSec = parseInt(match[1], 10);
            if (endSec !== duration) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [scenes.length - 1, 'time_range'],
                message: `La última escena debe terminar en ${duration} s (encontrado: ${endSec} s).`,
              });
            }
          } else {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [scenes.length - 1, 'time_range'],
              message: `El rango de tiempo de la última escena debe incluir su terminación en segundos (ej: "12–${duration} s").`,
            });
          }
        }
      }),
  });
}

export type VideoOutputSchema<_D extends VideoDuration> = ReturnType<typeof videoOutputFor>;

// Tipos inferidos para uso público
export type BaseOutput = z.infer<typeof baseOutput>;
export type PhotoOutput = z.infer<typeof photoOutputSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type CarouselOutput = z.infer<ReturnType<typeof carouselOutputFor>>;
export type Scene = z.infer<typeof sceneSchema>;
export type VideoOutput = z.infer<ReturnType<typeof videoOutputFor>>;

export {
  baseOutput,
  photoOutputSchema,
  slideSchema,
  carouselOutputFor,
  sceneSchema,
  videoOutputFor,
};
