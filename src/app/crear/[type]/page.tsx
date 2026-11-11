import Link from "next/link";
import CreationScreen from "@/components/creation/CreationScreen";
import { type BusinessProfile } from "@/components/creation/CreationForm";
import { getCreationFormProfile } from "@/lib/session";
import SiteHeader from "@/components/ui/SiteHeader";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type CreationType = "video" | "photo" | "carousel";

const SLUG_TO_TYPE = {
  video: "video",
  foto: "photo",
  carrusel: "carousel",
} as const;

type Slug = keyof typeof SLUG_TO_TYPE;

const META: Record<CreationType, { title: string; description: string }> = {
  video: {
    title: "Crear contenido — Guion de video | Café Santo Domingo",
    description: "Genera un guion de video por escenas para tu producto o servicio. Rellena el formulario y la IA crea tu guion optimizado para tu plataforma.",
  },
  photo: {
    title: "Crear contenido — Fotografía estática | Café Santo Domingo",
    description: "Describe tu producto o servicio y la IA creará una guía fotográfica completa para una sola imagen: composición, iluminación, fondo y copy.",
  },
  carousel: {
    title: "Crear contenido — Carrusel | Café Santo Domingo",
    description: "Define tu contenido y elige 3, 5 o 7 láminas: la IA creará una guía fotográfica por lámina con structure narrativa y copy final.",
  },
};

/** Resuelve la modalidad a partir del slug de la URL, o null si no existe. */
function resolveType(slug: string): CreationType | null {
  return (SLUG_TO_TYPE[slug as Slug] as CreationType) ?? null;
}

async function getProfile(): Promise<BusinessProfile | null> {
  try {
    return await getCreationFormProfile();
  } catch {
    return null;
  }
}

export async function generateMetadata(props: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type: typeParam } = await props.params;
  const type = resolveType(typeParam);
  if (!type) {
    return { title: "Crear contenido | Café Santo Domingo" };
  }
  return { title: META[type].title, description: META[type].description };
}

export default async function CreationPage(props: { params: Promise<{ type: string }> }) {
  const { type: typeParam } = await props.params;
  const type = resolveType(typeParam);
  if (!type) {
    notFound();
  }

  const profile = await getProfile();

  return (
    <main className="min-h-screen bg-ink pb-16">
      <SiteHeader />
      <div className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6 sm:pt-10">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted" aria-label="Miga de pan">
          <Link href="/" className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-white" aria-current="page">
            {type === "video" ? "Guion de video" : type === "photo" ? "Fotografía" : "Carrusel"}
          </span>
        </nav>

        <CreationScreen type={type} initialProfile={profile} />
      </div>
    </main>
  );
}
