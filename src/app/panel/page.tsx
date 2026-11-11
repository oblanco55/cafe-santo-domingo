import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/ui/SiteHeader";
import Card from "@/components/ui/Card";
import {
  CarouselIcon,
  CameraIcon,
  VideoIcon,
} from "@/components/ui/Icons";

const cards = [
  {
    href: "/crear/video",
    title: "Guion de video",
    description: "Guion por escenas + copy adaptado a la plataforma",
    Icon: VideoIcon,
  },
  {
    href: "/crear/foto",
    title: "Fotografía",
    description: "Guía para una sola imagen (cuadrada o vertical)",
    Icon: CameraIcon,
  },
  {
    href: "/crear/carrusel",
    title: "Carrusel",
    description: "Guía fotográfica por lámina + copy",
    Icon: CarouselIcon,
  },
];

export default async function PanelPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const name = session?.user?.name ?? "creador";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="px-4 py-10 text-mist">
        <div className="mx-auto max-w-5xl">
          <Card padded={false} className="p-6 sm:p-8">
            <header className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Hola, {name}
              </h1>
              <p className="mt-1 text-sm text-muted">¿Qué deseas crear hoy?</p>
            </header>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {cards.map(({ href, title, description, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col gap-3 rounded-2xl border border-mist/15 bg-ink p-5 transition hover:border-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-brand-orange via-brand-coral to-brand-fuchsia">
                    <Icon className="h-5 w-5 text-ink" />
                  </span>
                  <h2 className="text-base font-semibold text-white">{title}</h2>
                  <p className="text-sm leading-relaxed text-muted">{description}</p>
                  <span className="mt-2 text-xs font-medium text-mist transition group-hover:text-brand-orange">
                    Crear →
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center">
              <Link
                href="/creaciones"
                className="text-sm font-medium text-mist transition hover:text-brand-orange"
              >
                Ver mis creaciones →
              </Link>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
