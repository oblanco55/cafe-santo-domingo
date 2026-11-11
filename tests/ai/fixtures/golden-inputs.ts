/**
 * Banco de evaluación de prompts (ORDEN F2-2c): 6 casos representativos.
 * Los usa `npm run eval:ia` y los tests de prompts.
 */
import type { CreationType } from '@/lib/ai/engine';

export interface GoldenCase {
  id: string;
  type: CreationType;
  input: Record<string, unknown>;
}

export const GOLDEN_INPUTS: GoldenCase[] = [
  {
    id: 'foto-zapatos-producto-1x1-instagram',
    type: 'photo',
    input: {
      countryIso: 'MX', offerType: 'product', sector: 'moda',
      description: 'Zapatos de piel hechos a mano en León, suela de cuero cosida, color café.',
      platform: 'instagram', objective: 'presentacion', equipment: 'celular',
      resources: ['luz_natural', 'fondo_liso'], aspectRatio: '1:1', photoStyle: 'producto_solo',
    },
  },
  {
    id: 'foto-abogado-servicio-9x16-instagram',
    type: 'photo',
    input: {
      countryIso: 'DO', offerType: 'service', sector: 'legal',
      description: 'Abogada de derecho laboral en Santo Domingo; asesoría a trabajadores despedidos.',
      platform: 'instagram', objective: 'confianza', equipment: 'celular',
      resources: ['escritorio', 'luz_natural'], aspectRatio: '9:16', photoStyle: 'ia_recomienda',
    },
  },
  {
    id: 'carrusel-5-zapatos-presentacion',
    type: 'carousel',
    input: {
      countryIso: 'MX', offerType: 'product', sector: 'moda',
      description: 'Zapatos de piel hechos a mano en León, suela de cuero cosida, color café.',
      platform: 'instagram', objective: 'presentacion', equipment: 'celular',
      resources: ['luz_natural', 'fondo_liso'], slideCount: 5,
      carouselStructure: 'presentacion', aspectRatio: '1:1',
    },
  },
  {
    id: 'carrusel-3-restaurante-promocion',
    type: 'carousel',
    input: {
      countryIso: 'ES', offerType: 'product', sector: 'gastronomia',
      description: 'Restaurante de cocina valenciana en Madrid; paella de marisco para dos personas.',
      platform: 'facebook', objective: 'promocion', equipment: 'celular',
      resources: ['luz_natural'], slideCount: 3,
      carouselStructure: 'ia_recomienda', aspectRatio: '9:16',
    },
  },
  {
    id: 'video-15-belleza-tiktok',
    type: 'video',
    input: {
      countryIso: 'CO', offerType: 'service', sector: 'belleza',
      description: 'Salón de uñas en Medellín: manicura semipermanente con diseños a mano alzada.',
      platform: 'tiktok', objective: 'beneficio', equipment: 'celular',
      resources: ['aro_de_luz', 'modelo_persona'], duration: 15,
    },
  },
  {
    id: 'video-45-educacion-youtube',
    type: 'video',
    input: {
      countryIso: 'AR', offerType: 'service', sector: 'educacion',
      description: 'Profesora particular de matemáticas para secundaria, clases online por videollamada.',
      platform: 'youtube', objective: 'educativo', equipment: 'celular',
      resources: ['escritorio', 'lampara'], duration: 45,
    },
  },
];
