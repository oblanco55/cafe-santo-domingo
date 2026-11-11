"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

const base =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-brand-orange via-brand-coral to-brand-fuchsia text-ink hover:brightness-110",
  secondary:
    "border border-mist/20 bg-transparent text-white hover:bg-night",
};

export default function Button({
  variant = "primary",
  loading = false,
  loadingText = "Procesando…",
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? loadingText : children}
    </button>
  );
}
