import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SiteHeader from "@/components/ui/SiteHeader";
import CreationItemClient from "@/components/creation/CreationItemClient";

export const metadata = { title: "Creación — Script 28" };

export default async function CreationItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const item = await db.creation.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!item) {
    redirect("/creaciones");
  }

  const output = item.output as Record<string, unknown> | null;
  const title = output?.title as string | undefined;

  return (
    <div className="min-h-screen bg-ink">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <h1 className="text-2xl font-bold text-white">
          {title ?? "Creación"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Generada el {new Date(item.createdAt).toLocaleDateString("es-ES")}
          {item.parentId && " · variante de una creación anterior"}
        </p>
        <div className="mt-6">
          <CreationItemClient
            key={item.id}
            initialItem={{
              id: item.id,
              type: item.type,
              input: (item.input ?? null) as Record<string, unknown> | null,
              output: (item.output ?? null) as Record<string, unknown> | null,
              status: item.status,
              createdAt: item.createdAt.toISOString(),
              parentId: item.parentId,
            }}
          />
        </div>
      </main>
    </div>
  );
}
