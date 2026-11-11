import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export default function Card({
  className = "",
  padded = true,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-mist/15 bg-night ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
