/**
 * Utilidades PURAS de Café Santo Domingo para convertir la salida de la IA en texto
 * plano copiable. Sin React ni estado: solo tipado y transformación.
 *
 * Dos funciones principales:
 *  - `guideToText(type, output)` → la guía completa sin el bloque de copy.
 *  - `copyToText(output)`        → solo caption + CTA + hashtags.
 *
 * Se exporta también un normalizador `asBase` para validar que un `unknown`
 * coincide con la forma de salida (title, concept, platform, aspect_ratio,
 * caption, cta, hashtags, assumptions).
 */
import type {
  BaseOutput,
  PhotoOutput,
  CarouselOutput,
  VideoOutput,
} from '@/lib/contracts/outputs';
import { PLATFORMS, ASPECT_RATIOS } from '@/lib/contracts/catalogs';

export type CreationType = 'video' | 'photo' | 'carousel';

/** Versión mínima de cualquier salida (el baseOutput compartido). */
export function asBase(output: unknown): BaseOutput {
  if (!output || typeof output !== 'object') {
    throw new Error('La salida no es un objeto.');
  }
  return output as BaseOutput;
}

/** Coherence de las etiquetas de plataforma/formato en chips. */
export function platformLabel(p: string): string {
  return PLATFORMS[p as keyof typeof PLATFORMS] ?? p;
}
export function aspectLabel(r: string): string {
  const ratio = (ASPECT_RATIOS as Record<string, { label: string }>)[r];
  return ratio ? `${ratio.label} ${r}` : r;
}

/**
 * Normaliza un array potencialmente ausente y filtra vacíos.
 * Se usa para hashtags / assumptions / listas de pasos.
 */
function list(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((x) => typeof x === 'string' && x.trim() !== '');
}

/**
 * Convierte la salida de la IA en texto plano estructurado (guía).
 * No incluye caption / CTA / hashtags (los gestiona `copyToText`).
 */
export function guideToText(type: CreationType, output: unknown): string {
  const base = asBase(output);
  const lines: string[] = [];
  lines.push(base.title);
  lines.push(base.concept);
  lines.push('');

  const metaTags = [platformLabel(base.platform), aspectLabel(base.aspect_ratio)];
  if (base.visual_style) lines.push(`Estilo visual: ${base.visual_style} — ${metaTags.join(' · ')}`);
  else lines.push(`Plataforma: ${metaTags.join(' · ')}`);
  lines.push('');

  if (type === 'photo') {
    const o = output as PhotoOutput;
    const s = o.sections;
    const blocks: Array<[string, string]> = [
      ['Resumen creativo', base.creative_summary],
      ['Preparación', s.preparation],
      [
        'Composición',
        [
          `Posición: ${s.composition.subject_position}`,
          `Toma: ${s.composition.shot_type}`,
          `Ángulo: ${s.composition.angle}`,
          `Altura de cámara: ${s.composition.camera_height}`,
          `Distancia: ${s.composition.distance}`,
        ].join(' · '),
      ],
      [
        'Iluminación',
        [s.lighting.main_light, s.lighting.fill_light, s.lighting.background_light ?? null].
          filter(Boolean)
          .join(' · ') + (s.lighting.budget_alternative ? ` · Alternativa de bajo costo: ${s.lighting.budget_alternative}` : ''),
      ],
      ['Fondo y ambientación', s.background],
      ['Captura', s.capture_steps.map((p, i) => `${i + 1}. ${p}`).join(' ')],
      ['Formato y texto', s.format_and_text],
      ['Verificación', s.verification.map((v) => `«${v}»`).join(' ')],
    ];
    blocks.forEach(([h, body], i) => {
      lines.push(`${i + 1}. ${h}`);
      lines.push(body);
      lines.push('');
    });
  }

  if (type === 'carousel') {
    const o = output as CarouselOutput;
    lines.push('Estilo y configuración general');
    lines.push(`Iluminación común: ${o.general_setup.lighting}`);
    lines.push(`Paleta de color: ${o.general_setup.color}`);
    lines.push('');
    o.slides.forEach((s) => {
      lines.push(`Lámina ${s.index} · ${s.purpose}`);
      lines.push(`Encuadre: ${s.framing}`);
      lines.push(`Ángulo: ${s.angle}`);
      lines.push(`Luz: ${s.lighting}`);
      lines.push(`Fondo: ${s.background}`);
      lines.push(`Utilería: ${s.props}`);
      lines.push(`Acción: ${s.actions}`);
      lines.push(`Texto sobre la imagen: «${s.overlay_text}»`);
      lines.push('');
    });
  }

  if (type === 'video') {
    const o = output as VideoOutput;
    lines.push('Escenas');
    o.scenes.forEach((s) => {
      lines.push(
        `${s.index}. ${s.time_range} · ${s.shot} · ${s.action} — Narración: ${s.narration} — Texto: ${s.on_screen_text}`
      );
    });
    lines.push('');
  }

  // Supuestos y recomendaciones (si existen)
  const assumptions = list(base.assumptions);
  if (assumptions.length > 0) {
    lines.push('Supuestos y recomendaciones');
    assumptions.forEach((a) => lines.push(`· ${a}`));
    lines.push('');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Copia solo el bloque de publicación: caption + CTA + hashtags.
 * Nada de guía (title, concepto, bloques, láminas, escenas).
 */
export function copyToText(output: unknown): string {
  const base = asBase(output);
  const parts: string[] = [];
  if (base.caption) parts.push(base.caption);
  if (base.cta) parts.push(base.cta);
  const tags = list(base.hashtags);
  if (tags.length > 0) parts.push(tags.join(' '));
  return parts.join('\n\n').trim();
}
