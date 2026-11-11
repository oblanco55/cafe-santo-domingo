import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SiteHeader from "@/components/ui/SiteHeader";
import PerfilClient from "@/components/profile/PerfilClient";

export const metadata = { title: "Perfil del negocio — Café Santo Domingo" };

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.businessProfile.findFirst({
    where: { userId: session.user.id },
  });

  return (
    <div className="min-h-screen bg-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white">Perfil del negocio</h1>
        <p className="mt-1 text-sm text-muted">
          Configura tu información para que las guías se adapten a tu negocio.
        </p>
        <div className="mt-6">
          <PerfilClient
            initialProfile={profile
              ? {
                  countryIso: profile.countryIso ?? "",
                  offerType: profile.offerType ?? "",
                  sector: profile.sector ?? "",
                  sectorOther: profile.sectorOther ?? "",
                  description: profile.description ?? "",
                }
              : {
                  countryIso: "",
                  offerType: "",
                  sector: "",
                  sectorOther: "",
                  description: "",
                }}
          />
        </div>
      </main>
    </div>
  );
}
