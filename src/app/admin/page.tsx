"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Resumen del Panel de Administración (F2-4c).
 *
 * - 4 tarjetas: usuarios totales, usuarios activos, creaciones del periodo,
 *   errores.
 * - Barras simples de reparto por modalidad y por plataforma.
 * - Creaciones por día (últimas 14 fechas).
 * - Aviso text-warning cuando no hay ningún proveedor IA.
 *
 * Carga desde GET /api/admin/metrics → { metrics: {…} } (no cacheado).
 */

type Metrics = {
  users: {
    total: number;
    activos: number;
    nuevosPeriodo: number;
  };
  creations: {
    total: number;
    periodo: number;
    porTipo: { video: number; photo: number; carousel: number };
    porPlataforma: Record<string, number>;
    errores: number;
    porDia: Array<{ fecha: string; total: number }>;
  };
};

const TYPE_LABELS: Record<string, string> = {
  video: "Video",
  photo: "Fotografía",
  carousel: "Carrusel",
};

export default function AdminResumen() {
  const [data, setData] = useState<Metrics | null>(null);
  const [noProvider, setNoProvider] = useState(false);
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
      const res = await fetch("/api/admin/metrics", { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          (body as { error?: { message?: string } })?.error?.message ??
          "No se pudieron obtener las métricas.";
        throw new Error(msg);
      }
      const json = (await res.json()) as { metrics: Metrics };
      setData(json.metrics);
      let providersEmpty = false;
      try {
        const pc = await fetch("/api/admin/ai/providers", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (pc.ok) {
          const pJson = (await pc.json().catch(() => null)) as { providers?: unknown[] } | null;
          providersEmpty = !Array.isArray(pJson?.providers) || pJson.providers.length === 0;
        }
      } catch {
        // Si la consulta de proveedores falla, el aviso se mantiene apagado.
      }
      setNoProvider(providersEmpty);
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

  if (failed) {
    return (
      <section aria-label="Error al cargar el resumen" className="space-y-4">
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-5">
          <h2 className="text-sm font-semibold text-danger">Hubo un problema al cargar el resumen</h2>
          <p className="mt-1 text-sm text-mist">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-mist/20 px-4 py-2 text-sm font-medium text-mist hover:text-white"
          >
            Reintentar
          </button>
        </div>
        <p className="text-sm text-muted">
          El resto de la sección funciona con normalidad. Puedes seguir a
          Usuarios, Creaciones, Textos legales, IA o Ajustes desde el menú lateral.
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" aria-hidden="true" />
        Cargando métricas del sistema…
      </div>
    );
  }

  const typeItems = [
    { key: "video", label: TYPE_LABELS.video, value: data.creations.porTipo.video ?? 0 },
    { key: "photo", label: TYPE_LABELS.photo, value: data.creations.porTipo.photo ?? 0 },
    { key: "carousel", label: TYPE_LABELS.carousel, value: data.creations.porTipo.carousel ?? 0 },
  ];
  const platformItems = Object.entries(data.creations.porPlataforma ?? {}).map(
    ([k, v]) => ({ key: k, label: k, value: v as number })
  );
  const dailyItems = (data.creations.porDia ?? []).map((d) => ({
    date: d.fecha,
    count: d.total,
  }));

  return (
    <div className="space-y-6">
      {noProvider && (
        <div
          role="status"
          className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning"
        >
          ⚠️ No hay ningún proveedor de IA configurado. Las creaciones se
          generan en modo simulado hasta que añadas al menos uno en
          <a href="/admin/ia" className="ml-1 underline underline-offset-2">IA</a>.
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-900/30 bg-[#1e120c]/70 p-4">
        <div>
          <h2 className="font-bold text-white text-sm">Campaña Café Santo Domingo</h2>
          <p className="text-xs text-muted">Base de datos de participantes y clientes fidelizados</p>
        </div>
        <a
          href="/api/admin/leads-export"
          download
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md"
        >
          📊 Descargar Leads en Excel (CSV)
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label="Usuarios totales"
          value={data.users.total}
          helper="cuentas registradas"
        />
        <Tile
          label="Usuarios activos"
          value={data.users.activos}
          helper="con sesión vigente"
          tone={data.users.activos > 0 ? "orange" : "muted"}
        />
        <Tile
          label="Creaciones (periodo)"
          value={data.creations.periodo}
          helper="en el periodo"
          tone={data.creations.periodo > 0 ? "orange" : "muted"}
        />
        <Tile
          label="Errores"
          value={data.creations.errores}
          helper="fallos registrados"
          tone={data.creations.errores > 0 ? "danger" : "muted"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Bars title="Reparto por modalidad" items={typeItems} />
        <Bars title="Reparto por plataforma" items={platformItems} />
      </div>

      <DailyChart items={dailyItems} />
    </div>
  );
}

function Tile({
  label,
  value,
  helper,
  tone = "muted",
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "orange" | "danger" | "muted";
}) {
  const ring =
    tone === "orange"
      ? "border-brand-orange/30 bg-brand-orange/5"
      : tone === "danger"
        ? "border-danger/40 bg-danger/10"
        : "border-mist/10 bg-night/40";
  return (
    <div className={`rounded-2xl border p-4 ${ring}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </div>
  );
}

function Bars({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string; value: number }>;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section
      className="rounded-2xl border border-mist/10 bg-night/40 p-4"
      aria-label={`${title}`}
    >
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-muted">
        {items.length === 0
          ? "Sin datos todavía."
          : `${items.reduce((s, i) => s + i.value, 0)} creaciones`}
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((i) => (
          <li key={i.key}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-mist">{i.label}</span>
              <span className="tabular-nums text-muted">{i.value}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink">
              <div
                className="h-full rounded-full bg-brand-orange transition-all"
                style={{ width: `${Math.round((i.value / max) * 100)}%` }}
                role="presentation"
                aria-hidden="true"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DailyChart({
  items,
}: {
  items: Array<{ date: string; count: number }>;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section
      className="rounded-2xl border border-mist/10 bg-night/40 p-4"
      aria-label="Creaciones por día"
    >
      <h2 className="text-sm font-semibold text-white">Creaciones por día</h2>
      <p className="mt-1 text-xs text-muted">
        {items.length === 0 ? "Sin datos." : `${items.length} fechas`}
      </p>
      <div
        className="mt-4 flex h-28 items-end gap-1.5 sm:gap-2"
        aria-hidden="true"
      >
        {items.map((d) => {
          const pct = Math.round((d.count / max) * 100);
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end overflow-hidden rounded-md bg-ink/60">
                <div
                  className="w-full bg-brand-orange transition-all"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit" }).format(
                  new Date(d.date)
                )}
              </span>
            </div>
          );
        })}
      </div>
      <ul className="mt-4 space-y-1">
        {[...items].reverse().map((d) => (
          <li
            key={d.date}
            className="flex items-center justify-between text-xs text-muted"
          >
            <span>
              {new Intl.DateTimeFormat("es-ES", {
                day: "2-digit",
                month: "short",
              }).format(new Date(d.date))}
            </span>
            <span className="tabular-nums text-mist">{d.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
