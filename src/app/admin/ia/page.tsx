import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IA — Panel Admin",
};

import AdminIA from "@/components/admin/IA";

export default function IAPage() {
  return (
    <section aria-label="Proveedores de IA" className="space-y-4">
      <AdminIA />
    </section>
  );
}
