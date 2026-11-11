import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Textos legales — Panel Admin",
};

import AdminLegal from "@/components/admin/Legal";

export default function LegalPage() {
  return (
    <section aria-label="Textos legales" className="space-y-4">
      <AdminLegal />
    </section>
  );
}
