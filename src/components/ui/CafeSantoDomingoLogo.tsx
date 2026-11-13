import React from 'react';
import { Dancing_Script } from 'next/font/google';

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['500', '700'],
});

export interface CafeSantoDomingoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export default function CafeSantoDomingoLogo({
  className = '',
  size = 'md',
  showTagline = true,
}: CafeSantoDomingoLogoProps) {
  const sizeClasses = {
    sm: 'text-xl sm:text-2xl',
    md: 'text-3xl sm:text-4xl',
    lg: 'text-4xl sm:text-5xl',
  };
  const cafeSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={`inline-flex flex-col items-center select-none leading-none ${className}`}>
      <span
        className={`${dancingScript.className} font-medium italic text-emerald-500 ${cafeSizeClasses[size]}`}
      >
        Café
      </span>
      <span
        className={`${dancingScript.className} -mt-1 font-bold text-red-600 drop-shadow-sm ${sizeClasses[size]}`}
      >
        Santo Domingo
        <sup className="ml-0.5 text-[0.35em] font-sans not-italic align-super text-red-500">
          ®
        </sup>
      </span>
      {showTagline && (
        <span className="mt-0.5 text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-amber-300/80">
          Lo mejor de lo nuestro
        </span>
      )}
    </div>
  );
}
