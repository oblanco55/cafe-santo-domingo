import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Monetización — Panel Admin",
};

import AdminMonetizacion from "@/components/admin/Monetizacion";

export default function MonetizacionPage() {
  return (
    <section aria-label="Monetización" className="space-y-4">
      <AdminMonetizacion />
    </section>
  );
}
