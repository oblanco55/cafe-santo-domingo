"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiErrorMessage,
  ErrorBanner,
  LiveStatus,
  Spinner,
} from "./ui";

type Metrics = {
  users: {
    total: number;
    active: number;
  };
  creations: {
    total: number;
    ok: number;
    error: number;
  };
  ai: {
    providers: number;
  };
};

/**
 * Tarjeta de resumo del panel admin: total usuarios (con activos), total
 * creaciones generadas (exitosas y fallidas), y proveedores IA activos.
 *
 * Carga lazy desde GET /api/admin/metrics. Ante error de la llamada el
 * panel principal sigue siendo útil (los enlaces laterales funcionan), así
 * que solo se pinta un banner suave con el detalle.
 */
export default function AdminHome() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setError("");
    setFailed(false);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/admin/metrics", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(body, "No se pudieron obtener las métricas."));
      }
      const json = (await res.json()) as Metrics & Record<string, unknown>;
      setData(json);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const tile = (
    label: string,
    value: string,
    sub: React.ReactNode,
    tone: "orange" | "success" | "danger" | "muted" = "muted"
  ) => (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "orange"
          ? "border-brand-orange/30 bg-brand-orange/5"
          : tone === "success"
            ? "border-success/30 bg-success/5"
            : tone === "danger"
              ? "border-danger/30 bg-danger/5"
              : "border-mist/10 bg-ink"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );

  return (
    <section aria-label="Resumen general" className="space-y-4">
      {failed ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!data && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-mist/10 bg-ink p-5 text-sm text-muted">
              <Spinner /> Cargando resumen…
            </div>
          )}
          {data && (
            <>
              {tile(
                "Usuarios",
                String(data.users.total),
                statusLine(data.users.active, "activo(s)"),
                "orange"
              )}
              {tile(
                "Creaciones",
                String(data.creations.total),
                statusLine(data.creations.ok, "exitosas"),
                "success"
              )}
              {tile(
                "Errores IA",
                String(data.creations.error),
                "creaciones fallidas",
                data.creations.error > 0 ? "danger" : "muted"
              )}
              {tile(
                "Proveedores IA",
                String(data.ai.providers),
                "configurados en el sistema",
                "muted"
              )}
            </>
          )}
        </div>
      )}
      <LiveStatus
        text={failed ? "Error al cargar métricas." : data ? "Resumen actualizado." : "Cargado en curso."}
      />
    </section>
  );
}

function statusLine(value: number | null | undefined, suffix: string): React.ReactNode {
  if (value === null || value === undefined) return "cargando…";
  return (
    <>
      {value} {suffix}
    </>
  );
}

/** helper vacío (eliminado) */
