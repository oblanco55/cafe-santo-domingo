import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/ui/SiteHeader";
import MisCreaciones from "@/components/creation/MisCreaciones";

export const metadata = { title: "Mis creaciones — Script 28" };

export default async function CreacionesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="min-h-screen bg-ink">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white">Mis creaciones</h1>
        <p className="mt-1 text-sm text-muted">
          Todas las guías que has generado, con sus variantes de regeneración.
        </p>
        <div className="mt-6">
          <MisCreaciones />
        </div>
      </main>
    </div>
  );
}
