import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Card from "@/components/ui/Card";
import SiteHeader from "@/components/ui/SiteHeader";
import { getLegalDocument } from "@/lib/admin";
import { renderMarkdownSafe } from "@/lib/markdown";

/**
 * Página legal pública (términos / privacidad).
 *
 * - Lee el documento de `LegalDocument` en BD por `slug`.
 * - Si no existe → `notFound()` (404).
 * - Renderiza el Markdown de forma segura (marked + DOMPurify, sin scripts).
 * - "Última actualización" en formato es-ES + versión del documento.
 *
 * Server Component: no hay `"use client"`; lee de BD antes de enviar HTML.
 */
export default async function LegalPage({
  slug,
}: {
  slug: "terminos" | "privacidad";
}) {
  let doc;
  try {
    doc = await getLegalDocument(slug);
  } catch {
    notFound();
    return null; // nunca llega aquí; notFound() lanza
  }

  const title = doc.title || "Documento legal";
  const updatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeZone: "America/Santiago",
  }).format(doc.updatedAt);
  const html = renderMarkdownSafe(doc.content);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="px-4 py-10 text-mist">
        <div className="mx-auto max-w-2xl">
          <Card className="p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-widest text-white">
              {title}
            </h1>

            <p className="mt-2 text-xs text-muted">
              Última actualización: {updatedAt} · versión {doc.version}
            </p>

            <div
              className="legal-body mt-6 space-y-4 text-sm leading-relaxed text-mist"
              // El HTML ya pasó por marked + DOMPurify (script/iframe/event
              // handlers eliminados; se permiten h1–h6, p, ul/ol/li, a, em, strong, blockquote, br, hr, code, pre, table).
              dangerouslySetInnerHTML={{ __html: html }}
            />

            <Link
              href="/"
              className="mt-8 inline-block text-sm text-white underline underline-offset-2 transition hover:text-mist"
            >
              ← Volver al inicio
            </Link>
          </Card>
        </div>
      </main>
    </div>
  );
}

export async function generateMetadata({
  slug,
}: {
  slug: "terminos" | "privacidad";
}): Promise<Metadata> {
  try {
    const doc = await getLegalDocument(slug);
    const title = doc.title || "Documento legal";
    return { title, description: `${title} — Café Santo Domingo` };
  } catch {
    return { title: "Documento legal — Café Santo Domingo" };
  }
}
