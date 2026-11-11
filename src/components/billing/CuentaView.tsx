"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";

type Usage = {
  monetizationEnabled: boolean;
  freeUsedThisMonth: number;
  freeQuota: number;
  credits: number;
  subscription: {
    plan: string;
    status: string;
    used: number;
    quota: number | null;
    periodEnd: string | null;
  } | null;
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(iso));

export default function CuentaView() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/billing/usage", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setUsage((await res.json()) as Usage);
    } catch {
      setError("No se pudo cargar tu cuenta. Inténtalo de nuevo.");
    }
  }, []);
  useEffect(() => void load(), [load]);

  const cancel = async () => {
    if (!window.confirm("¿Seguro que quieres cancelar tu suscripción? No se renovará al terminar el periodo.")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/billing/subscriptions/cancel", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "No se pudo cancelar la suscripción.");
      setNotice("Suscripción cancelada.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  if (error && !usage) return <p role="alert" className="text-center text-sm text-danger">{error}</p>;
  if (!usage) return <p role="status" className="text-center text-sm text-muted">Cargando tu cuenta…</p>;

  const sub = usage.subscription;
  return (
    <div className="space-y-4">
      {!usage.monetizationEnabled && (
        <Card><p className="text-sm text-mist">Por ahora todas las creaciones son gratuitas.</p></Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Creaciones gratis este mes</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {usage.freeUsedThisMonth} <span className="text-base font-normal text-muted">de {usage.freeQuota}</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Créditos disponibles</p>
          <p className="mt-1 text-2xl font-bold text-white">{usage.credits}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-white">Suscripción</h2>
        {sub ? (
          <div className="mt-2 space-y-1 text-sm text-mist">
            <p>Plan: <span className="font-semibold text-white">{sub.plan}</span></p>
            <p>Uso del periodo: {sub.used} {sub.quota === null ? "(ilimitado)" : `de ${sub.quota}`}</p>
            {sub.periodEnd && <p>Se renueva el {fmtDate(sub.periodEnd)}</p>}
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="mt-3 rounded-xl border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
            >
              {cancelling ? "Cancelando…" : "Cancelar suscripción"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No tienes una suscripción activa.</p>
        )}
      </Card>

      {notice && <p role="status" className="text-sm text-success">{notice}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Link href="/planes" className="inline-block text-sm font-semibold text-brand-orange hover:underline">
        Ver planes y paquetes →
      </Link>
    </div>
  );
}
