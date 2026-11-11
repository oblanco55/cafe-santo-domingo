/**
 * Catálogos de SCRIPT 28: valores válidos y sus etiquetas para mostrar
 * en la interfaz. Solo constantes y tipos — sin lógica de negocio.
 */

/** Redes sociales soportadas para publicar el contenido generado. */
export const PLATFORMS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
} as const;
export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

/** Tipo de oferta que el usuario promociona. */
export const OFFER_TYPES = {
  product: 'Producto',
  service: 'Servicio',
} as const;
export type OfferType = (typeof OFFER_TYPES)[keyof typeof OFFER_TYPES];

/** Lista unificada de sectores (decisión D4 de PLAN.md). */
export const SECTORS = {
  moda: 'Moda',
  gastronomia: 'Gastronomía',
  belleza: 'Belleza',
  salud: 'Salud',
  educacion: 'Educación',
  tecnologia: 'Tecnología',
  servicios_profesionales: 'Servicios profesionales',
  legal: 'Legal',
  turismo: 'Turismo',
  inmobiliaria: 'Inmobiliaria',
  automotriz: 'Automotriz',
  hogar: 'Hogar',
  otro: 'Otro',
} as const;
export type Sector = (typeof SECTORS)[keyof typeof SECTORS];

/** Objetivo comunicativo de la publicación. */
export const OBJECTIVES = {
  presentacion: 'Presentación',
  beneficio: 'Beneficio',
  promocion: 'Promoción',
  confianza: 'Confianza',
  educativo: 'Educativo',
  otro: 'Otro',
} as const;
export type Objective = (typeof OBJECTIVES)[keyof typeof OBJECTIVES];

/** Equipo de captura disponible para el usuario. */
export const EQUIPMENT = {
  celular: 'Celular',
  camara: 'Cámara',
  no_se: 'No sé',
} as const;
export type Equipment = (typeof EQUIPMENT)[keyof typeof EQUIPMENT];

/** Recursos físicos disponibles para producir el contenido. */
export const RESOURCES = {
  luz_natural: 'Luz natural',
  lampara: 'Lámpara',
  aro_de_luz: 'Aro de luz',
  fondo_liso: 'Fondo liso',
  escritorio: 'Escritorio',
  modelo_persona: 'Modelo / persona',
  ninguno: 'Ninguno',
} as const;
export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

/** Tipología de fotografía estática. */
export const PHOTO_STYLES = {
  producto_solo: 'Producto solo',
  producto_en_uso: 'Producto en uso',
  persona_servicio: 'Persona ofreciendo servicio',
  espacio_instalacion: 'Espacio o instalación',
  ia_recomienda: 'Que la IA recomiende',
} as const;
export type PhotoStyle = (typeof PHOTO_STYLES)[keyof typeof PHOTO_STYLES];

/** Estructuras narrativas disponibles para carruseles. */
export const CAROUSEL_STRUCTURES = {
  presentacion: 'Presentación',
  beneficios: 'Beneficios',
  paso_a_paso: 'Paso a paso',
  problema_solucion: 'Problema y solución',
  ia_recomienda: 'Que la IA recomiende',
} as const;
export type CarouselStructure =
  (typeof CAROUSEL_STRUCTURES)[keyof typeof CAROUSEL_STRUCTURES];

/**
 * Relaciones de aspecto admitidas.
 * Decisión del usuario (diferencia D1 de PLAN.md): SOLO 1:1 y 9:16,
 * aunque los documentos usen 4:5 en sus ejemplos.
 */
export const ASPECT_RATIOS = {
  '1:1': { label: 'Cuadrada', width: 1080, height: 1080 },
  '9:16': { label: 'Vertical Story', width: 1080, height: 1920 },
} as const;
export type AspectRatio = keyof typeof ASPECT_RATIOS;

export const SLIDE_COUNTS = [3, 5, 7] as const;
export type SlideCount = (typeof SLIDE_COUNTS)[number];

export const VIDEO_DURATIONS = [15, 30, 45] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

/**
 * Países admitidos: los 21 Estados hispanohablantes + los mercados
 * principales no hispanohablantes. ISO-3166 alfa-2, orden alfabético.
 */
type Country = {
  readonly iso: string;
  readonly name: string;
};
export const COUNTRIES: readonly Country[] = [
  { iso: 'AR', name: 'Argentina' },
  { iso: 'BO', name: 'Bolivia' },
  { iso: 'BR', name: 'Brasil' },
  { iso: 'CA', name: 'Canadá' },
  { iso: 'CL', name: 'Chile' },
  { iso: 'CO', name: 'Colombia' },
  { iso: 'CR', name: 'Costa Rica' },
  { iso: 'CU', name: 'Cuba' },
  { iso: 'DO', name: 'República Dominicana' },
  { iso: 'EC', name: 'Ecuador' },
  { iso: 'SV', name: 'El Salvador' },
  { iso: 'GQ', name: 'Guinea Ecuatorial' },
  { iso: 'GT', name: 'Guatemala' },
  { iso: 'HN', name: 'Honduras' },
  { iso: 'MX', name: 'México' },
  { iso: 'NI', name: 'Nicaragua' },
  { iso: 'PA', name: 'Panamá' },
  { iso: 'PY', name: 'Paraguay' },
  { iso: 'PE', name: 'Perú' },
  { iso: 'PR', name: 'Puerto Rico' },
  { iso: 'ES', name: 'España' },
  { iso: 'US', name: 'Estados Unidos' },
  { iso: 'UY', name: 'Uruguay' },
  { iso: 'VE', name: 'Venezuela' },
  { iso: 'PT', name: 'Portugal' },
  { iso: 'FR', name: 'Francia' },
  { iso: 'IT', name: 'Italia' },
  { iso: 'DE', name: 'Alemania' },
  { iso: 'GB', name: 'Reino Unido' },
].sort((a, b) => a.name.localeCompare(b.name, 'es'));
export type CountryIso = (typeof COUNTRIES)[number]['iso'];
