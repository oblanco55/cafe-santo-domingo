import type { Metadata } from "next";
import { auth } from "@/auth";
import SiteHeader from "@/components/ui/SiteHeader";
import PlanesView from "@/components/billing/PlanesView";

export const metadata: Metadata = { title: "Planes — Script 28" };

export default async function PlanesPage() {
  const session = await auth();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="px-4 py-10 text-mist">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Planes y créditos</h1>
            <p className="mt-1 text-sm text-muted">Elige cómo seguir creando contenido con Script 28.</p>
          </header>
          <PlanesView userId={session?.user?.id ?? null} />
        </div>
      </main>
    </div>
  );
}
