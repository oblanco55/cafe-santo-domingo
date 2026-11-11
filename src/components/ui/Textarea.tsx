"use client";

import type { TextareaHTMLAttributes } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const base =
  "w-full rounded-xl border border-mist/20 bg-ink px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-orange";

export default function Textarea({
  className = "",
  invalid,
  "aria-invalid": ariaInvalid,
  ...rest
}: TextareaProps & { invalid?: boolean }) {
  return (
    <textarea
      rows={rest.rows ?? 4}
      className={`${base} ${
        (invalid || ariaInvalid) ? "border-danger" : ""
      } ${className}`}
      aria-invalid={(invalid || ariaInvalid) || undefined}
      {...rest}
    />
  );
}
