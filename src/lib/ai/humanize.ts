/**
 * Convierte la entrada validada (con códigos de catálogo) en un objeto con
 * etiquetas en español para el mensaje que recibe la IA (ORDEN F2-2c).
 * El input original se sigue guardando tal cual; esto solo afecta al prompt.
 */
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
} from '@/lib/contracts/catalogs';
import type { CarouselInput, PhotoInput, VideoInput } from '@/lib/contracts';

export const AI_CHOOSES = 'Elige tú la mejor opción y justifícala';

type Type = 'video' | 'photo' | 'carousel';
type AnyInput = VideoInput | PhotoInput | CarouselInput;

function label(catalog: Record<string, string>, code: string | null | undefined): string {
  if (!code) return 'No indicado';
  if (code === 'ia_recomienda') return AI_CHOOSES;
  return catalog[code] ?? code;
}

function aspectLabel(code: string): string {
  const a = ASPECT_RATIOS[code as keyof typeof ASPECT_RATIOS];
  return a ? `${a.label} ${code} (${a.width}×${a.height})` : code;
}

export function humanizeInput(type: Type, input: AnyInput): Record<string, unknown> {
  const sector =
    input.sector === 'otro' && input.sectorOther?.trim()
      ? input.sectorOther.trim()
      : label(SECTORS, input.sector);
  const resources = (input.resources ?? []).filter((r) => r !== 'ninguno');

  const out: Record<string, unknown> = {
    pais: COUNTRIES.find((c) => c.iso === input.countryIso)?.name ?? input.countryIso,
    que_promociona: label(OFFER_TYPES, input.offerType),
    sector,
    descripcion: input.description,
    plataforma: label(PLATFORMS, input.platform),
    objetivo: label(OBJECTIVES, input.objective),
    equipo: label(EQUIPMENT, input.equipment),
    recursos: resources.length
      ? resources.map((r) => label(RESOURCES, r))
      : 'Ninguno indicado',
  };

  if (type === 'photo') {
    const p = input as PhotoInput;
    out.formato = aspectLabel(p.aspectRatio);
    out.tipo_de_foto = label(PHOTO_STYLES, p.photoStyle);
  } else if (type === 'carousel') {
    const c = input as CarouselInput;
    out.formato = aspectLabel(c.aspectRatio);
    out.numero_de_laminas = c.slideCount;
    out.estructura = label(CAROUSEL_STRUCTURES, c.carouselStructure);
  } else {
    out.formato = 'Vertical 9:16 (1080×1920)';
    out.duracion = `${(input as VideoInput).duration} segundos`;
  }
  return out;
}
