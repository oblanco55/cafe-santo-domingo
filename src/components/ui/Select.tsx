"use client";

import type { SelectHTMLAttributes } from "react";
import type { ReactNode } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const base =
  "w-full min-h-[44px] appearance-none rounded-xl border border-mist/20 bg-ink px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange";

export default function Select({
  className = "",
  invalid,
  "aria-invalid": ariaInvalid,
  children,
  ...rest
}: SelectProps & { invalid?: boolean; children: ReactNode }) {
  return (
    <select
      className={`${base} ${
        (invalid || ariaInvalid) ? "border-danger" : ""
      } ${className}`}
      aria-invalid={(invalid || ariaInvalid) || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}
