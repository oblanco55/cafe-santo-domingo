import Image from "next/image";

export interface LogoProps {
  height?: number;
  priority?: boolean;
  className?: string;
}

const RATIO = 1454 / 354; // 1454×354, logo oficial transparente

export default function Logo({
  height = 32,
  priority = false,
  className = "",
}: LogoProps) {
  return (
    <Image
      src="/brand/logo-script28.png"
      alt="Script 28"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
