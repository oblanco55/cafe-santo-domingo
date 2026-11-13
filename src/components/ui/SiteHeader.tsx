import Link from "next/link";
import { auth, signOut } from "@/auth";
import CafeSantoDomingoLogo from "./CafeSantoDomingoLogo";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

/** Enlaces del usuario con sesión (escritorio en la fila principal; móvil en una segunda fila). */
const USER_LINKS = [
  { href: "/creaciones", label: "Mis creaciones" },
  { href: "/perfil", label: "Perfil del negocio" },
  { href: "/planes", label: "Planes" },
  { href: "/cuenta", label: "Mi cuenta" },
];

/** wide: ancho del panel de administración (tablas a pantalla completa). */
export default async function SiteHeader({ wide = false }: { wide?: boolean } = {}) {
  const width = wide ? "max-w-[1600px]" : "max-w-5xl";
  const session = await auth();
  return (
    <header className="border-b border-mist/15">
      <div className={`mx-auto flex min-h-[60px] ${width} items-center justify-between gap-4 px-4 py-3`}>
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="Café Santo Domingo — inicio" className="shrink-0">
            <CafeSantoDomingoLogo size="sm" showTagline={false} />
          </Link>
          {session?.user?.role === "admin" && (
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-1.5 text-xs font-medium text-brand-orange transition hover:bg-brand-orange/20 sm:inline-flex"
            >
              <span aria-hidden="true">📊</span>
              Administración
            </Link>
          )}
        </div>
        {session?.user ? (
          <div className="flex items-center gap-2">
            <nav aria-label="Tu cuenta" className="hidden items-center gap-1 sm:flex">
              {USER_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-mist transition hover:text-white">
                  {l.label}
                </Link>
              ))}
            </nav>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-mist/20 bg-transparent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
            >
              Cerrar sesión
            </button>
          </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-mist/20 bg-transparent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          >
            Iniciar sesión
          </Link>
        )}
      </div>
      {session?.user && (
        <nav aria-label="Tu cuenta" className={`mx-auto flex ${width} gap-1 overflow-x-auto px-4 pb-2 sm:hidden`}>
          {USER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 rounded-lg border border-mist/15 px-3 py-1.5 text-xs text-mist transition hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
