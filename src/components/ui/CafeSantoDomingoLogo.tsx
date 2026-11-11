import React from 'react';

export interface CafeSantoDomingoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function CafeSantoDomingoLogo({
  className = '',
  size = 'md',
}: CafeSantoDomingoLogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-3xl sm:text-4xl',
  };

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <div className="flex items-center gap-2">
        {/* Ícono de Taza Roja de Café Santo Domingo */}
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-md ring-2 ring-amber-400/40">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-amber-200"
          >
            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            <line x1="6" y1="2" x2="6" y2="4" />
            <line x1="10" y1="2" x2="10" y2="4" />
            <line x1="14" y1="2" x2="14" y2="4" />
          </svg>
        </div>
        <span
          className={`font-serif font-black tracking-wide text-white drop-shadow-sm ${sizeClasses[size]}`}
        >
          CAFÉ <span className="text-amber-400">SANTO DOMINGO</span>
        </span>
      </div>
      <span className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-amber-300/80 mt-0.5">
        El gran café de nuestra tierra
      </span>
    </div>
  );
}
