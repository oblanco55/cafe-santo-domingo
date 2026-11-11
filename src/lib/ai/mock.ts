/**
 * Proveedor Mock para Café Santo Domingo.
 * - Soporta guiones tradicionales (video, foto, carrusel).
 * - Soporta la generación de Avatar 3D y Video para Café Santo Domingo
 *   (ideal para desarrollo y pruebas gratuitas sin consumir saldo en Fal.ai o Replicate).
 */
import {
  ASPECT_RATIOS,
  COUNTRIES,
  PHOTO_STYLES,
  PLATFORMS,
  SECTORS,
  type AspectRatio,
  type Platform,
  type SlideCount,
  type VideoDuration,
} from '@/lib/contracts';
import type { AIProvider, GenerateArgs, GenerateResult } from './provider';

export type MockType = 'video' | 'photo' | 'carousel' | 'avatar';

export interface MockHint {
  type: MockType;
  input: Record<string, unknown>;
}

const TYPE_LABEL: Record<string, string> = {
  video: 'video',
  photo: 'foto',
  carousel: 'carrusel',
  avatar: 'avatar',
};

const TITLE_NOUN: Record<string, string> = {
  video: 'Guion de video',
  photo: 'Guía de fotografía',
  carousel: 'Guía de carrusel',
  avatar: 'Avatar Café Santo Domingo',
};

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function labelOf(map: Record<string, string>, key: string): string {
  return (map as Record<string, string>)[key] ?? key;
}

function sectorName(input: Record<string, unknown>): string {
  const sector = asString(input.sector, 'otro');
  if (sector === 'otro') return asString(input.sectorOther, 'tu sector');
  return labelOf(SECTORS, sector);
}

function base(
  type: MockType,
  input: Record<string, unknown>,
  aspectRatio: AspectRatio = '1:1',
) {
  const platform = asString(input.platform, 'instagram') as Platform;
  const country =
    COUNTRIES.find((c) => c.iso === input.countryIso)?.name ?? 'República Dominicana';
  const platformLabel = labelOf(PLATFORMS, platform);
  const aspectLabel = ASPECT_RATIOS[aspectRatio]?.label ?? 'Cuadrada';

  return {
    title: `${TITLE_NOUN[type]}: ${sectorName(input)}`,
    concept: `Presentación de ${sectorName(input)} adaptada a ${platformLabel}, formato ${aspectLabel}.`,
    creative_summary: `Guía de ${TYPE_LABEL[type]} para ${sectorName(input)} (${platformLabel}), con enfoque práctico y recursos accesibles.`,
    platform,
    aspect_ratio: aspectRatio,
    visual_style: `Estilo directo y cálido para ${country}, en español y con lenguaje cercano.`,
    caption: `Contenido de ${TYPE_LABEL[type]} orientado a ${platformLabel}.`,
    cta: '¡Comparte con tus amigos y disfruta el sabor de Café Santo Domingo!',
    hashtags: [
      `#${platform}`,
      '#CafeSantoDomingo',
      '#ElSaborQueNosUne',
      '#OrgulloDominicano',
    ],
    assumptions: [
      'Generación en modo de prueba local (Mock Provider).',
    ],
  };
}

function aspectOf(input: Record<string, unknown>): AspectRatio {
  const raw = asString(input.aspectRatio, '');
  if (raw === '9:16' || raw === '1:1') return raw;
  return '1:1';
}

function slideCountOf(input: Record<string, unknown>): SlideCount {
  const n = input.slideCount;
  return n === 3 || n === 5 || n === 7 ? n : 5;
}

function durationOf(input: Record<string, unknown>): VideoDuration {
  const n = input.duration;
  return n === 15 || n === 30 || n === 45 ? n : 30;
}

function photoOutput(input: Record<string, unknown>) {
  const aspect = aspectOf(input);
  const style = asString(input.photoStyle, 'ia_recomienda');
  const subject = sectorName(input);
  const vertical = aspect === '9:16';
  const b = base('photo', input, aspect);

  const styleLabel =
    style !== 'ia_recomienda'
      ? ` con estilo ${PHOTO_STYLES[style as keyof typeof PHOTO_STYLES]}`
      : '';

  return {
    ...b,
    creative_summary: `Una sola toma de ${subject}${styleLabel}, pensada para ${ASPECT_RATIOS[aspect].label.toLowerCase()}.`,
    sections: {
      preparation:
        'Limpia el lente del celular, apaga la linterna, y coloca la taza o paquete de Café Santo Domingo sobre una superficie cálida.',
      composition: {
        subject_position: 'Centrado en el tercio medio, con aire en el 30% superior de la imagen.',
        shot_type: 'Primer plano o medio plano.',
        angle: '45° por sobre la horizontal hacia abajo.',
        camera_height: 'A la altura de los ojos o 10–15 cm por encima.',
        distance: vertical ? '60–90 cm' : '40–80 cm',
      },
      lighting: {
        main_light: 'Luz natural suave de ventana a 90° sobre la izquierda.',
        fill_light: 'Cartulina blanca o pared clara detrás para sombras suaves.',
        budget_alternative: 'Lámpara de luz cálida a 60 cm.',
      },
      background: 'Superficie de madera rústica o barra de cocina moderna.',
      capture_steps: [
        'Coloca la taza humeante en el centro.',
        'Ajusta la distancia y enfoca.',
        'Toma 3 disparos y elige el más nítido.',
      ],
      format_and_text: vertical
        ? 'Reserva 250 px arriba y abajo para zona segura de historias.'
        : 'Mantén el sujeto dentro del cuadro central.',
      verification: [
        'Revisa que la taza y el logo se vean claros y atractivos.',
        'Comprueba que no haya reflejos ni sombras duras sobre el producto.',
        'Confirma que el encuadre respete la proporción elegida antes de publicar.',
      ],
    },
  };
}

function carouselOutput(input: Record<string, unknown>) {
  const aspect = aspectOf(input);
  const n = slideCountOf(input);
  const b = base('carousel', input, aspect);

  const slides = Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    purpose: i === 0 ? 'Gancho inicial' : i === n - 1 ? 'Cierre con llamada a la acción' : 'Detalle y beneficio',
    framing: aspect === '9:16' ? 'Vertical 9:16' : 'Cuadrado 1:1',
    angle: '45° frontal',
    lighting: 'Luz natural cálida',
    background: 'Fondo cálido y acogedor',
    props: 'Taza de Café Santo Domingo, granos de café, cafetera tradicional',
    actions: 'Mostrar el aroma y la experiencia del café',
    overlay_text: 'El sabor que nos une cada día',
  }));

  return {
    ...b,
    general_setup: {
      lighting: 'Luz natural matutina',
      color: 'Gama de marrones café, ámbar dorado y acentos rojos Santo Domingo',
    },
    slides,
  };
}

function videoOutput(input: Record<string, unknown>) {
  const duration = durationOf(input);
  const mid = Math.round((3 + (duration - 3)) / 2);
  const b = base('video', input, '9:16');

  return {
    ...b,
    scenes: [
      {
        index: 1,
        time_range: '0–3 s',
        shot: 'Primer plano de café recién colado cayendo en una taza roja.',
        action: 'El vapor sube mientras se sirve una taza perfecta.',
        narration: 'Ese primer sorbo que despierta el alma dominicana...',
        on_screen_text: 'El Sabor Que Nos Une 🇩🇴☕',
      },
      {
        index: 2,
        time_range: `3–${mid} s`,
        shot: 'Plano medio de la persona sonriendo y disfrutando el café.',
        action: 'Sostiene la taza y saluda a la cámara con calidez.',
        narration: 'Porque el buen café no se toma solo, se vive.',
        on_screen_text: '100% Orgullo Dominicano',
      },
      {
        index: 3,
        time_range: `${mid}–${duration - 3} s`,
        shot: 'Plano amplio compartiendo la taza con familia o amigos.',
        action: 'Levanta la taza en un gesto de brindis compartido.',
        narration: 'El café que se comparte sabe mejor entre los nuestros.',
        on_screen_text: 'Hecho para Compartir',
      },
      {
        index: 4,
        time_range: `${duration - 3}–${duration} s`,
        shot: 'Cierre con el logo de Café Santo Domingo y la taza humeante.',
        action: 'Un brindis con la taza hacia la cámara.',
        narration: 'Café Santo Domingo. El gran café de nuestra tierra.',
        on_screen_text: '#CafeSantoDomingo',
      },
    ],
  };
}

/**
 * Genera un avatar SVG / Data URL compuesto con estilo Café Santo Domingo
 * Si el usuario subió una selfie, se inserta en un marco de embajador con branding oficial.
 */
export function buildMockAvatarSvg(opts: {
  userName?: string;
  favoriteProduct?: string;
  templateStyle?: string;
  selfieBase64?: string;
}): string {
  const name = opts.userName || 'Embajador Santo Domingo';
  const product = opts.favoriteProduct || 'Café Santo Domingo';
  const style = opts.templateStyle || 'barista';

  const styleTitles: Record<string, string> = {
    barista: 'Barista Experto Santo Domingo',
    colonial: 'Embajador Zona Colonial',
    plantacion: 'Embajador Cafetalero Jarabacoa',
  };

  const title = styleTitles[style] || 'Embajador Oficial';

  // SVG de alta calidad que se visualiza como imagen inmediata
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f110b"/>
      <stop offset="50%" stop-color="#3b1d11"/>
      <stop offset="100%" stop-color="#120905"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e8b86d"/>
      <stop offset="50%" stop-color="#fdf1cd"/>
      <stop offset="100%" stop-color="#c58c38"/>
    </linearGradient>
    <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d62828"/>
      <stop offset="100%" stop-color="#9d0208"/>
    </linearGradient>
    <clipPath id="circleClip">
      <circle cx="400" cy="440" r="230"/>
    </clipPath>
  </defs>

  <!-- Fondo Premium -->
  <rect width="800" height="1000" fill="url(#bgGrad)"/>
  
  <!-- Patrón decorativo de fondo -->
  <circle cx="400" cy="440" r="320" fill="none" stroke="#d4973b" stroke-width="2" stroke-opacity="0.15" stroke-dasharray="10 15"/>
  <circle cx="400" cy="440" r="280" fill="none" stroke="#d4973b" stroke-width="1.5" stroke-opacity="0.25"/>

  <!-- Encabezado / Branding -->
  <text x="400" y="85" text-anchor="middle" fill="url(#goldGrad)" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" letter-spacing="4">
    CAMPAÑA OFICIAL 2026
  </text>
  <text x="400" y="130" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="36" font-weight="900" letter-spacing="1">
    CAFÉ SANTO DOMINGO
  </text>
  <text x="400" y="160" text-anchor="middle" fill="#d4973b" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-style="italic">
    "El sabor que nos une"
  </text>

  <!-- Marco Dorado de la Foto -->
  <circle cx="400" cy="440" r="240" fill="url(#goldGrad)"/>
  <circle cx="400" cy="440" r="234" fill="#2b140b"/>

  <!-- Foto / Selfie del usuario o ilustración de embajador -->
  ${
    opts.selfieBase64 && opts.selfieBase64.startsWith('data:')
      ? `<image href="${opts.selfieBase64}" x="160" y="200" width="480" height="480" preserveAspectRatio="xMidYMid slice" clip-path="url(#circleClip)"/>`
      : `<!-- Ilustración silueta estilizada -->
      <g clip-path="url(#circleClip)">
        <rect x="170" y="210" width="460" height="460" fill="#4a2414"/>
        <circle cx="400" cy="400" r="100" fill="#f5d6ba"/>
        <path d="M 270 580 C 290 490, 510 490, 530 580 Z" fill="#9d0208"/>
        <!-- Taza de café en mano -->
        <circle cx="400" cy="540" r="45" fill="#d62828" stroke="#fdf1cd" stroke-width="3"/>
        <circle cx="400" cy="540" r="30" fill="#3b1d11"/>
        <!-- Vapor de café -->
        <path d="M 390 480 Q 400 460 395 440" stroke="#fdf1cd" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>
        <path d="M 410 485 Q 420 465 415 445" stroke="#fdf1cd" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>
      </g>`
  }

  <!-- Aro interior brillante -->
  <circle cx="400" cy="440" r="230" fill="none" stroke="url(#goldGrad)" stroke-width="4"/>

  <!-- Sello / Insignia de Embajador -->
  <g transform="translate(400, 715)">
    <!-- Placa dorada central -->
    <rect x="-190" y="-35" width="380" height="70" rx="35" fill="url(#goldGrad)" filter="drop-shadow(0px 8px 12px rgba(0,0,0,0.6))"/>
    <rect x="-186" y="-31" width="372" height="62" rx="31" fill="#1f110b"/>
    <text x="0" y="8" text-anchor="middle" fill="url(#goldGrad)" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" letter-spacing="2">
      ${title.toUpperCase()}
    </text>
  </g>

  <!-- Datos del usuario y producto -->
  <text x="400" y="810" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="32" font-weight="bold">
    ${name}
  </text>
  <text x="400" y="845" text-anchor="middle" fill="#f5c279" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500">
    Fanático Oficial de: <tspan font-weight="bold" fill="#ffffff">${product}</tspan>
  </text>

  <!-- Footer con bandera dominicana decorativa -->
  <line x1="250" y1="885" x2="550" y2="885" stroke="#d4973b" stroke-opacity="0.3" stroke-width="1"/>
  
  <g transform="translate(385, 905)">
    <rect x="-35" y="-12" width="70" height="24" rx="4" fill="#002b7f"/>
    <rect x="-35" y="0" width="70" height="12" rx="4" fill="#ce1126"/>
    <rect x="-35" y="-4" width="70" height="8" fill="#ffffff"/>
    <rect x="-4" y="-12" width="8" height="24" fill="#ffffff"/>
  </g>

  <text x="400" y="955" text-anchor="middle" fill="#a89a91" font-family="system-ui, -apple-system, sans-serif" font-size="14" letter-spacing="1">
    #CafeSantoDomingo · #ElSaborQueNosUne
  </text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Genera la respuesta mock completa para Café Santo Domingo.
 */
export function buildMockAvatarOutput(input: Record<string, unknown>) {
  const name = asString(input.userName, 'Amante del Café');
  const favoriteProduct = asString(input.favoriteProduct, 'Café Santo Domingo Tradicional');
  const templateStyle = asString(input.templateStyle, 'barista');
  const selfie = asString(input.selfie, '');
  const format = asString(input.format, 'avatar');

  const imageUrl = buildMockAvatarSvg({
    userName: name,
    favoriteProduct,
    templateStyle,
    selfieBase64: selfie,
  });

  const caption = `☕ ¡Oficialmente Embajador de Café Santo Domingo! Nada como empezar cada mañana con el verdadero sabor de mi tierra: ${favoriteProduct}. ¿A quién se le antoja un cafecito hoy? 🇩🇴✨\n\n#CafeSantoDomingo #ElSaborQueNosUne #OrgulloDominicano #CafeDominicano`;

  return {
    title: `Avatar Oficial de ${name}`,
    imageUrl,
    videoUrl: format === 'video' ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' : undefined,
    caption,
    templateStyle,
    favoriteProduct,
    userName: name,
    model: 'mock-santo-domingo-v1',
    aspect_ratio: '9:16',
    platform: 'instagram',
  };
}

export function buildMockOutput(
  type: MockType,
  input: Record<string, unknown>,
): unknown {
  if (type === 'avatar') return buildMockAvatarOutput(input);
  if (type === 'photo') return photoOutput(input);
  if (type === 'carousel') return carouselOutput(input);
  return videoOutput(input);
}

export class MockProvider implements AIProvider {
  private hint: MockHint | null = null;

  setHint(hint: MockHint): void {
    this.hint = hint;
  }

  private detectType(args: GenerateArgs): MockType {
    if (this.hint) return this.hint.type;
    const t = args.toolName.toLowerCase();
    if (t.includes('avatar') || t.includes('santodomingo') || t.includes('selfie'))
      return 'avatar';
    if (t.includes('photo') || t.includes('estática') || t.includes('estatic'))
      return 'photo';
    if (t.includes('carousel') || t.includes('carrusel')) return 'carousel';
    return 'video';
  }

  async generate(args: GenerateArgs): Promise<GenerateResult> {
    const type = this.detectType(args);
    const input = this.hint?.input ?? {};
    return { data: buildMockOutput(type, input), model: 'mock-santo-domingo-v1' };
  }
}
