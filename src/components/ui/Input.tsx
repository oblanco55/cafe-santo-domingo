"use client";

import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const base =
  "w-full min-h-[44px] rounded-xl border border-mist/20 bg-ink px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-orange";

export default function Input({
  className = "",
  invalid,
  "aria-invalid": ariaInvalid,
  ...rest
}: InputProps & { invalid?: boolean }) {
  return (
    <input
      className={`${base} ${
        (invalid || ariaInvalid) ? "border-danger" : ""
      } ${className}`}
      aria-invalid={(invalid || ariaInvalid) || undefined}
      {...rest}
    />
  );
}
