import { z } from 'zod';
import {
  ASPECT_RATIOS,
  CAROUSEL_STRUCTURES,
  COUNTRIES,
  EQUIPMENT,
  OBJECTIVES,
  OFFER_TYPES,
  PHOTO_STYLES,
  PLATFORMS,
  RESOURCES,
  SECTORS,
} from './catalogs';

/**
 * Esquemas de ENTRADA de las tres modalidades (video, fotografía, carrusel).
 * Mensajes de error en español, listos para mostrar al usuario.
 * Sin lógica de negocio: solo validación de datos.
 */

const COUNTRY_ISO_VALUES = COUNTRIES.map((c) => c.iso);

const ELIGIBLE_ENUM_MESSAGE = 'Selecciona una opción válida';

const countryIsoSchema = z
  .enum(COUNTRY_ISO_VALUES, { error: ELIGIBLE_ENUM_MESSAGE })
  .describe('País de residencia del usuario (ISO-3166 alfa-2)');

const offerTypeSchema = z
  .enum(Object.keys(OFFER_TYPES) as [string, ...string[]], {
    error: ELIGIBLE_ENUM_MESSAGE,
  })
  .describe('Tipo de oferta: producto o servicio');

const platformSchema = z
  .enum(Object.keys(PLATFORMS) as [string, ...string[]], {
    error: ELIGIBLE_ENUM_MESSAGE,
  })
  .describe('Red social donde se publicará el contenido');

const sectorSchema = z
  .enum(Object.keys(SECTORS) as [string, ...string[]], {
    error: ELIGIBLE_ENUM_MESSAGE,
  })
  .describe('Sector de actividad del usuario');

const sectorOtherSchema = z
  .string()
  .trim()
  .min(2, 'Si elegiste «Otro», indica el sector en al menos 2 caracteres.')
  .max(80, 'El sector libre no debe superar 80 caracteres.')
  .nullish();

const descriptionSchema = z
  .string()
  .trim()
  .min(20, 'Describe tu producto o servicio con al menos 20 caracteres.')
  .max(
    1500,
    'La descripción no debe superar 1500 caracteres. Sé más breve.',
  )
  .describe('Descripción libre del producto o servicio a promocionar');

const objectiveSchema = z
  .enum(Object.keys(OBJECTIVES) as [string, ...string[]], {
    error: ELIGIBLE_ENUM_MESSAGE,
  })
  .default('presentacion');

const equipmentSchema = z
  .enum(Object.keys(EQUIPMENT) as [string, ...string[]], {
    error: ELIGIBLE_ENUM_MESSAGE,
  })
  .optional();

const RESOURCE_VALUES = Object.keys(RESOURCES) as [string, ...string[]];

const resourcesSchema = z
  .array(z.enum(RESOURCE_VALUES))
  .optional()
  .superRefine((resources, ctx) => {
    if (!resources) return;
    const unique = new Set(resources);
    if (unique.size !== resources.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No repitas las mismas opciones de recursos.',
      });
      return;
    }
    if (resources.includes('ninguno') && resources.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Si no tienes recursos disponibles, selección solo «Ninguno».',
      });
    }
  });

/** Campos comunes a las tres modalidades. */
const commonBase = z.object({
  countryIso: countryIsoSchema,
  offerType: offerTypeSchema,
  sector: sectorSchema,
  sectorOther: sectorOtherSchema,
  description: descriptionSchema,
  platform: platformSchema,
  objective: objectiveSchema,
  equipment: equipmentSchema,
  resources: resourcesSchema,
});

/** Base común con reglas condicionales (sector «otro», recursos). */
const commonInputSchema = commonBase.superRefine((input, ctx) => {
  if (input.sector === 'otro') {
    const other = input.sectorOther?.trim();
    if (!other || other.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sectorOther'],
        message:
          'Como elegiste «Otro», escribe el sector de tu producto o servicio.',
      });
    }
  }
});

/** Entrada del módulo de VIDEO. */
const videoInputSchema = commonInputSchema.extend({
  duration: z
    .union([z.literal(15), z.literal(30), z.literal(45)], {
      error: ELIGIBLE_ENUM_MESSAGE,
    })
    .describe('Duración en segundos: 15, 30 o 45'),
});

/** Entrada del módulo de FOTOGRAFÍA ESTÁTICA. */
const photoInputSchema = commonInputSchema.extend({
  aspectRatio: z
    .enum(Object.keys(ASPECT_RATIOS) as [string, ...string[]], {
      error: ELIGIBLE_ENUM_MESSAGE,
    })
    .describe('Formato de la imagen: cuadrada 1:1 o vertical 9:16'),
  photoStyle: z
    .enum(Object.keys(PHOTO_STYLES) as [string, ...string[]], {
      error: ELIGIBLE_ENUM_MESSAGE,
    })
    .default('ia_recomienda'),
});

/** Entrada del módulo de CARRUSEL. */
const carouselInputSchema = commonInputSchema.extend({
  slideCount: z
    .union([z.literal(3), z.literal(5), z.literal(7)], {
      error: ELIGIBLE_ENUM_MESSAGE,
    })
    .describe('Número de láminas: 3, 5 o 7'),
  carouselStructure: z
    .enum(Object.keys(CAROUSEL_STRUCTURES) as [string, ...string[]], {
      error: ELIGIBLE_ENUM_MESSAGE,
    })
    .default('ia_recomienda'),
  aspectRatio: z
    .enum(Object.keys(ASPECT_RATIOS) as [string, ...string[]], {
      error: ELIGIBLE_ENUM_MESSAGE,
    })
    .describe('Formato del carrusel: cuadrado 1:1 o vertical 9:16'),
});

export type CommonInput = z.infer<typeof commonInputSchema>;
export type VideoInput = z.infer<typeof videoInputSchema>;
export type PhotoInput = z.infer<typeof photoInputSchema>;
export type CarouselInput = z.infer<typeof carouselInputSchema>;

export {
  commonInputSchema,
  videoInputSchema,
  photoInputSchema,
  carouselInputSchema,
};
