"use client";

import { usePathname } from "next/navigation";

/** Enlaces laterales (escritorio) + pestañas (móvil, scroll horizontal). */
const LINKS: Array<{ href: string; label: string; icon: string }> = [
  { href: "/admin", label: "Resumen", icon: "📊" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "👥" },
  { href: "/admin/creaciones", label: "Creaciones", icon: "✨" },
  { href: "/admin/legal", label: "Textos legales", icon: "📄" },
  { href: "/admin/ia", label: "IA", icon: "🤖" },
  { href: "/admin/monetizacion", label: "Monetización", icon: "💳" },
  { href: "/admin/ajustes", label: "Ajustes", icon: "⚙️" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // Escritorio: columna fija; móvil: scroll horizontal
  return (
    <>
      {/* Escritorio (≥ lg) */}
      <nav
        className="hidden flex-col gap-1 self-start rounded-2xl border border-mist/10 bg-night/60 p-2 lg:flex"
        aria-label="Secciones del panel de administración"
      >
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isActive(l.href)
                ? "bg-brand-orange/15 font-semibold text-white"
                : "text-muted hover:bg-ink hover:text-white"
            }`}
          >
            <span aria-hidden="true" className="text-base leading-none">{l.icon}</span>
            <span>{l.label}</span>
          </a>
        ))}
      </nav>

      {/* Móvil: fila con scroll X */}
      <nav
        className="flex gap-1 overflow-x-auto rounded-2xl border border-mist/10 bg-night/60 p-2 lg:hidden"
        aria-label="Secciones del panel de administración"
      >
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition ${
              isActive(l.href)
                ? "bg-brand-orange/20 font-semibold text-white"
                : "text-muted hover:text-white"
            }`}
          >
            <span aria-hidden="true" className="text-sm leading-none">{l.icon}</span>
            <span>{l.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
