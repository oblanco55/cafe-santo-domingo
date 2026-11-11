"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import PayPalButtons from "./PayPalButtons";

type Catalog = {
  enabled: boolean;
  freeCreationsPerMonth: number;
  currency: string;
  paypal: { clientId: string | null; mode: "sandbox" | "live" };
  plans: Array<{
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    currency: string;
    interval: "month" | "year";
    creationsPerPeriod: number | null;
    paypalPlanId: string;
  }>;
  packs: Array<{ id: string; name: string; credits: number; priceCents: number; currency: string }>;
};

export function fmtMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default function PlanesView({ userId }: { userId: string | null }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/billing/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setCatalog)
      .catch(() => setLoadError("No se pudieron cargar los planes. Inténtalo de nuevo en unos minutos."));
  }, []);

  if (loadError) return <p role="alert" className="text-center text-sm text-danger">{loadError}</p>;
  if (!catalog) return <p role="status" className="text-center text-sm text-muted">Cargando planes…</p>;

  if (!catalog.enabled) {
    return (
      <Card className="text-center">
        <p className="text-base font-semibold text-white">Por ahora todas las creaciones son gratuitas.</p>
        <Link href="/panel" className="mt-3 inline-block text-sm text-brand-orange hover:underline">Ir a crear →</Link>
      </Card>
    );
  }

  const canPay = Boolean(catalog.paypal.clientId);
  const notify = (tone: "success" | "danger") => (text: string) => setMessage({ tone, text });
  const buyBlock = (button: React.ReactNode) =>
    !userId ? (
      <Link href="/login" className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-mist/20 px-4 text-sm font-medium text-white hover:bg-ink">
        Inicia sesión para comprar
      </Link>
    ) : canPay ? (
      button
    ) : (
      <p className="text-xs text-muted">Los pagos estarán disponibles muy pronto.</p>
    );

  return (
    <div className="space-y-8">
      {message && (
        <div
          role={message.tone === "danger" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${message.tone === "success" ? "border-success/30 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"}`}
        >
          {message.text}
          {message.tone === "success" && (
            <Link href="/cuenta" className="ml-2 font-semibold underline">Ver mi cuenta</Link>
          )}
        </div>
      )}

      {catalog.freeCreationsPerMonth > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-white">Gratis</h2>
          <p className="mt-1 text-sm text-mist">
            {catalog.freeCreationsPerMonth} creaciones al mes sin coste. Cuando las uses, elige un plan o un paquete de créditos.
          </p>
        </Card>
      )}

      {catalog.plans.length > 0 && (
        <section aria-labelledby="planes-sus">
          <h2 id="planes-sus" className="text-lg font-semibold text-white">Suscripciones</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {catalog.plans.map((p) => (
              <Card key={p.id} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-white">{p.name}</h3>
                <p className="text-2xl font-bold text-white">
                  {fmtMoney(p.priceCents, p.currency)}
                  <span className="text-sm font-normal text-muted"> / {p.interval === "year" ? "año" : "mes"}</span>
                </p>
                <p className="text-sm text-mist">
                  {p.creationsPerPeriod === null ? "Creaciones ilimitadas" : `${p.creationsPerPeriod} creaciones por ${p.interval === "year" ? "año" : "mes"}`}
                </p>
                {p.description && <p className="text-sm text-muted">{p.description}</p>}
                <div className="mt-auto pt-2">
                  {buyBlock(
                    <PayPalButtons
                      kind="subscription"
                      clientId={catalog.paypal.clientId!}
                      currency={p.currency}
                      planId={p.id}
                      paypalPlanId={p.paypalPlanId}
                      userId={userId!}
                      onSuccess={notify("success")}
                      onError={notify("danger")}
                    />,
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {catalog.packs.length > 0 && (
        <section aria-labelledby="planes-packs">
          <h2 id="planes-packs" className="text-lg font-semibold text-white">Paquetes de créditos</h2>
          <p className="mt-1 text-sm text-muted">Pago único. Cada crédito es una creación y no caduca.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {catalog.packs.map((k) => (
              <Card key={k.id} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-white">{k.name}</h3>
                <p className="text-2xl font-bold text-white">{fmtMoney(k.priceCents, k.currency)}</p>
                <p className="text-sm text-mist">{k.credits} créditos</p>
                <div className="mt-auto pt-2">
                  {buyBlock(
                    <PayPalButtons
                      kind="order"
                      clientId={catalog.paypal.clientId!}
                      currency={k.currency}
                      packId={k.id}
                      onSuccess={notify("success")}
                      onError={notify("danger")}
                    />,
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {catalog.plans.length === 0 && catalog.packs.length === 0 && (
        <p className="text-center text-sm text-muted">Pronto habrá planes y paquetes disponibles.</p>
      )}
      {catalog.paypal.mode === "sandbox" && canPay && (
        <p className="text-center text-xs text-warning">Modo de pruebas de PayPal: no se realizan cobros reales.</p>
      )}
    </div>
  );
}
