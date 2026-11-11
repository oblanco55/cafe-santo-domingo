import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ajustes — Panel Admin",
};

import AdminAjustes from "@/components/admin/Ajustes";

export default function AjustesPage() {
  return (
    <section aria-label="Ajustes" className="space-y-4">
      <AdminAjustes />
    </section>
  );
}
