
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creaciones — Panel Admin",
};

import AdminCreations from "@/components/admin/Creations";

export default function CreationsPage() {
  return (
    <section aria-label="Creaciones" className="space-y-4">
      <AdminCreations />
    </section>
  );
}
