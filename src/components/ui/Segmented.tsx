"use client";

import { useId } from "react";

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedProps {
  name: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  className?: string;
}

const base =
  "min-h-[44px] rounded-xl border bg-night px-4 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange";

export default function Segmented({
  name,
  options,
  value,
  onChange,
  invalid = false,
  className = "",
}: SegmentedProps) {
  const groupLabel = useId();
  return (
    <div
      role="group"
      aria-labelledby={groupLabel}
      aria-label={name}
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap ${className}`}
    >
      <span id={groupLabel} className="sr-only">
        {name}
      </span>
      {options.map((option) => {
        const selected = option.value === value;
        const border = selected
          ? "border-brand-orange"
          : invalid
            ? "border-danger/70"
            : "border-mist/15";
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            data-segmented-value={option.value}
            className={`${base} ${border} ${
              selected ? "text-white" : "text-mist hover:border-mist/40 hover:text-white"
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
