import { auth, signOut } from "@/auth";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/ui/SiteHeader";
import AdminNav from "./nav";

/**
 * Layout del Panel de Administración (F2-4).
 *
 * - Solo accesible con sesión iniciada y role === "admin" (el resto → notFound
 *   como pide la orden para ocultar la sección frente a usuarios normales).
 * - Header global del sitio más navegación lateral en escritorio y
 *   pestañas con scroll horizontal en móvil.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-mist">
      <SiteHeader wide />
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:h-fit">
          <AdminNav />
          <form action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }} className="mt-6 hidden rounded-xl border border-mist/10 p-3 lg:block">
            <button
              type="submit"
              className="w-full rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
            >
              Cerrar sesión
            </button>
          </form>
          <form action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }} className="mt-3 lg:hidden">
            <button
              type="submit"
              className="w-full rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger"
            >
              Cerrar sesión
            </button>
          </form>
        </aside>
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
