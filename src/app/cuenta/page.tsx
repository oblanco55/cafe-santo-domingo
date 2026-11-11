import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SiteHeader from "@/components/ui/SiteHeader";
import CuentaView from "@/components/billing/CuentaView";

export const metadata: Metadata = { title: "Mi cuenta — Café Santo Domingo" };

export default async function CuentaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="px-4 py-10 text-mist">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">Mi cuenta</h1>
          <CuentaView />
        </div>
      </main>
    </div>
  );
}
