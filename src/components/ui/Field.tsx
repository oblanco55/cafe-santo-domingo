import { useId } from "react";
import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  /** Muestra la etiqueta (por defecto solo para lectores de pantalla). */
  showLabel?: boolean;
  children: ReactNode;
}

/**
 * Wrapper de campo: label + children + error/hint con aria.
 * `children` debe ser un control (Input/Select/Textarea) que declare
 * `aria-invalid` y `aria-describedby` (ver esos componentes).
 */
export default function Field({
  label,
  htmlFor,
  error,
  hint,
  showLabel = false,
  children,
}: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={showLabel ? "text-sm font-medium text-white" : "sr-only"}>{label}</label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
