"use client";

/**
 * Kit de UI compartido del Panel de Administración (F2-4).
 * Sin estado propio (solo presentacional), para compartir entre secciones.
 */

import { useState, useCallback, useRef } from "react";

/** Extrae el error legible de una respuesta ApiError de la API admin. */
export function apiErrorMessage(
  body: unknown,
  fallback = "Ocurrió un error. Inténtalo de nuevo."
): string {
  const err = (body as { error?: { message?: string; fieldErrors?: Record<string, string | string[]> } } | null)?.error;
  if (err?.message) return err.message;
  if (err?.fieldErrors) {
    const first = Object.values(err.fieldErrors)[0];
    if (first) return Array.isArray(first) ? first[0] : String(first);
  }
  return fallback;
}

/**
 * Hook de feedback de copia para los botones "Copiar guía / copy" con
 * reutilización del mismo patrón que ResultView (timer 2s + aria-live).
 */
export function useCopyFeedback(labels: Array<string>) {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  void labels; // el hook acepta una lista para el aria-live genérico

  const doCopy = useCallback((label: string, text: string) => {
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
  }, []);

  return { copied, doCopy };
}

/** Formatea una fecha ISO legible en español. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Chip de estado / rol con color coherente al tema. */
export function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "danger" | "warning" | "muted" | "orange";
  children: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
    warning: "bg-warning/15 text-warning",
    muted: "bg-mist/10 text-muted",
    orange: "bg-brand-orange/15 text-brand-orange",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[tone]}`}
    >
      {children}
    </span>
  );
}

/** Boton con estado "cargando" (spinner inline). */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block ${className} animate-spin rounded-full border-2 border-current border-t-transparent align-middle`}
      aria-hidden="true"
    />
  );
}

/** Feedback de estado guardado con aria-live para accesibilidad. */
export function LiveStatus({ text }: { text: string }) {
  if (!text) return null;
  return (
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </span>
  );
}

/** Banner de error de sección (con retry opcional). */
export function ErrorBanner({
  title = "Hubo un problema al cargar esta sección",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-danger/30 bg-danger/10 p-5"
      role="alert"
    >
      <h3 className="text-sm font-semibold text-danger">{title}</h3>
      <p className="mt-1 text-sm text-mist">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-coral"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Empty state para tablas sin filtros. */
export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-mist/10 text-xl"
        aria-hidden="true"
      >
        ✨
      </span>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
