"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  guideToText,
  copyToText,
  asBase,
  platformLabel,
  aspectLabel,
  type CreationType,
} from "./format";
import type {
  PhotoOutput,
  CarouselOutput,
  VideoOutput,
} from "@/lib/contracts/outputs";

interface ResultViewProps {
  type: CreationType;
  output: unknown;
  onCreateAnother: () => void;
  onEdit: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

/** Copia texto al portapapeles con feedback "Copiado ✓". */
function useCopyFeedback() {
  const [copied, setCopied] = useState<null | "guia" | "copy">(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doCopy = useCallback(
    (label: "guia" | "copy", text: string) => {
      const fallback = () => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      };
      try {
        void navigator.clipboard.writeText(text).catch(fallback);
      } catch {
        fallback();
      }
      setCopied(label);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(null), 2000);
    },
    []
  );

  // Limpia el timer al desmontar.
  useState(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  });

  return { copied, doCopy };
}

/** Chip de metadato (plataforma, formato). */
function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-mist/20 bg-ink px-3 py-1 text-xs font-medium text-mist">
      {children}
    </span>
  );
}

/** Tarjeta de bloque numerado (photo / carousel). */
function BlockCard({
  index,
  title,
  children,
}: {
  index?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full">
      <div className="flex items-start gap-3">
        {index !== undefined && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-ink"
            aria-hidden="true"
          >
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-mist">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Etiqueta + valor de una fila de composición / lámina. */
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-0.5 text-sm text-mist">{v}</dd>
    </div>
  );
}

export default function ResultView({
  type,
  output,
  onCreateAnother,
  onEdit,
  onRegenerate,
  regenerating,
}: ResultViewProps) {
  const base = asBase(output);
  const { copied, doCopy } = useCopyFeedback();

  const copyGuide = () => void doCopy("guia", guideToText(type, output));
  const copyCopy = () => void doCopy("copy", copyToText(base));

  return (
    <div className="w-full space-y-4">
      {/* Cabecera */}
      <Card className="w-full">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/20" aria-hidden="true">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-success" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 11l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white sm:text-lg">{base.title}</h2>
            <p className="mt-1 text-sm text-mist">{base.concept}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MetaChip>
                <svg viewBox="0 0 16 16" className="h-3 w-3 text-brand-orange" fill="currentColor" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" />
                </svg>
                {platformLabel(base.platform)}
              </MetaChip>
              <MetaChip>
                <svg viewBox="0 0 16 16" className="h-3 w-3 text-brand-orange" fill="currentColor" aria-hidden="true">
                  <rect x="3" y="6" width="10" height="6" rx="1" />
                </svg>
                {aspectLabel(base.aspect_ratio)}
              </MetaChip>
            </div>
          </div>
        </div>
      </Card>

      {/* GUÍA ESPECÍFICA POR MODALIDAD */}
      {type === "photo" && <PhotoGuide output={output as PhotoOutput} />}
      {type === "carousel" && <CarouselGuide output={output as CarouselOutput} />}
      {type === "video" && <VideoGuide output={output as VideoOutput} />}

      {/* SUPUESTOS (si existen) */}
      {base.assumptions && base.assumptions.length > 0 && (
        <Card className="w-full border-warning/40">
          <h3 className="text-sm font-semibold text-warning">Supuestos y recomendaciones</h3>
          <ul className="mt-2 space-y-1 text-sm text-mist">
            {base.assumptions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-warning" aria-hidden="true">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* COPY PARA PUBLICAR (bloque separado) */}
      <Card className="w-full border-brand-orange/40">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" className="h-5 w-5 text-brand-orange" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 5h12v10H4z" />
            <path d="M8 9.5h4M8 12h2.5" strokeLinecap="round" />
          </svg>
          <h3 className="text-sm font-semibold text-white">Copy para publicar</h3>
        </div>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-mist">
          <p className="text-white">{base.caption}</p>
          <p className="font-medium text-brand-orange">{base.cta}</p>
          {base.hashtags && base.hashtags.length > 0 && (
            <p className="text-muted">{base.hashtags.join(" ")}</p>
          )}
        </div>
      </Card>

      {/* BOTONES */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-col gap-2 sm:flex-1">
          <Button variant="secondary" onClick={copyGuide}>
            {copied === "guia" ? "Copiado ✓" : "Copiar guía"}
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-1">
          <Button variant="secondary" onClick={copyCopy}>
            {copied === "copy" ? "Copiado ✓" : "Copiar copy"}
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-1">
          <Button variant="secondary" onClick={onEdit}>
            Editar respuestas
          </Button>
        </div>
        {onRegenerate && (
          <div className="flex flex-col gap-2 sm:flex-1">
            <Button
              variant="primary"
              onClick={onRegenerate}
              loading={regenerating}
              loadingText="Regenerando…"
            >
              Regenerar variante
            </Button>
          </div>
        )}
        <div className="sm:flex-none">
          <Button variant="primary" onClick={onCreateAnother}>
            Crear otro
          </Button>
        </div>
      </div>

      {/* Ver en Mis creaciones */}
      <Link
        href="/creaciones"
        className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-brand-orange"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="3" width="12" height="10" rx="1" />
          <path d="M2 7h12" strokeLinecap="round" />
        </svg>
        Ver en Mis creaciones
      </Link>

      {/* Feedback de copia (aria-live) */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {copied === "guia" && "Guía copiada"}
        {copied === "copy" && "Copy copiado"}
      </span>
    </div>
  );
}

/* ----------------- Guía FOTOGRAFÍA (8 bloques) ----------------- */
function PhotoGuide({ output }: { output: PhotoOutput }) {
  const s = output.sections;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <BlockCard index={1} title="Resumen creativo">
        <p>{output.creative_summary}</p>
      </BlockCard>
      <BlockCard index={2} title="Preparación">
        <p>{s.preparation}</p>
      </BlockCard>
      <BlockCard index={3} title="Composición">
        <dl className="space-y-2">
          <KV k="Posición del sujeto" v={s.composition.subject_position} />
          <KV k="Tipo de toma" v={s.composition.shot_type} />
          <KV k="Ángulo" v={s.composition.angle} />
          <KV k="Altura de cámara" v={s.composition.camera_height} />
          <KV k="Distancia" v={s.composition.distance} />
        </dl>
      </BlockCard>
      <BlockCard index={4} title="Iluminación">
        <dl className="space-y-2">
          <KV k="Principal" v={s.lighting.main_light} />
          <KV k="Relleno" v={s.lighting.fill_light} />
          {s.lighting.background_light && <KV k="Fondo" v={s.lighting.background_light} />}
          <KV k="Alternativa de bajo costo" v={s.lighting.budget_alternative} />
        </dl>
      </BlockCard>
      <BlockCard index={5} title="Fondo y ambientación">
        <p>{s.background}</p>
      </BlockCard>
      <BlockCard index={6} title="Captura">
        <ol className="list-inside list-decimal space-y-1 pl-4">
          {s.capture_steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </BlockCard>
      <BlockCard index={7} title="Formato y texto">
        <p>{s.format_and_text}</p>
      </BlockCard>
      <BlockCard index={8} title="Verificación">
        <ul className="space-y-1">
          {s.verification.map((v, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-success" aria-hidden="true">✓</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </BlockCard>
    </div>
  );
}

/* ----------------- Guía CARRUSEL (por lámina) ----------------- */
function CarouselGuide({ output }: { output: CarouselOutput }) {
  return (
    <div className="space-y-4">
      <Card className="w-full">
        <h3 className="text-sm font-semibold text-white">Estilo y configuración general</h3>
        <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <KV k="Iluminación común" v={output.general_setup.lighting} />
          <KV k="Paleta de color" v={output.general_setup.color} />
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {output.slides.map((s) => (
          <Card key={s.index} className="w-full">
            <div className="flex items-start justify-between gap-3">
              <h4 className="min-w-0 text-sm font-semibold text-white">
                Lámina {s.index} · {s.purpose}
              </h4>
            </div>
            <dl className="mt-3 space-y-2">
              <KV k="Encuadre" v={s.framing} />
              <KV k="Ángulo" v={s.angle} />
              <KV k="Luz" v={s.lighting} />
              <KV k="Fondo" v={s.background} />
              <KV k="Utilería" v={s.props} />
              <KV k="Acción" v={s.actions} />
            </dl>
            <div className="mt-4 rounded-xl bg-ink p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-orange">
                Texto sobre la imagen
              </p>
              <p className="mt-1 text-base font-medium text-white">&ldquo;{s.overlay_text}&rdquo;</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ----------------- Guía VIDEO (tabla / tarjetas) ----------------- */
function VideoGuide({ output }: { output: VideoOutput }) {
  return (
    <Card className="w-full">
      <h3 className="text-sm font-semibold text-white">Guion por escenas</h3>
      {/* Móvil: tarjetas apiladas */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:hidden">
        {output.scenes.map((s) => (
          <div key={s.index} className="rounded-xl border border-mist/10 bg-ink p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-ink">
                {s.index}
              </span>
              <span className="text-sm font-medium text-white">{s.time_range}</span>
            </div>
            <dl className="mt-3 space-y-2">
              <KV k="Plano" v={s.shot} />
              <KV k="Acción" v={s.action} />
              <KV k="Narración" v={s.narration} />
              <KV k="Texto en pantalla" v={s.on_screen_text} />
            </dl>
          </div>
        ))}
      </div>
      {/* Escritorio: tabla responsive */}
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-mist/20 text-left">
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">#</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Tiempo</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Plano</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Acción</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Narración</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Texto en pantalla</th>
            </tr>
          </thead>
          <tbody>
            {output.scenes.map((s) => (
              <tr key={s.index} className="border-b border-mist/10 last:border-0">
                <td className="px-3 py-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-ink">
                    {s.index}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-medium text-white">{s.time_range}</td>
                <td className="px-3 py-3 text-mist">{s.shot}</td>
                <td className="px-3 py-3 text-mist">{s.action}</td>
                <td className="px-3 py-3 text-mist">{s.narration}</td>
                <td className="px-3 py-3 text-mist">{s.on_screen_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
