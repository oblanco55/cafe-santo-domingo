"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, ErrorBanner, LiveStatus, Spinner, StatusChip, EmptyState, fmtDate } from "./ui";

type CreationRow = {
  id: string;
  type: string;
  status: string;
  platform: string | null;
  model: string | null;
  userEmail: string | null;
  title: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type ApiResponse = {
  items: CreationRow[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type Detail = {
  id: string;
  type: string;
  status: string;
  userId: string;
  userEmail: string | null;
  platform: string | null;
  title: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  model: string | null;
  createdAt: string;
  parentId: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  video: "Video",
  photo: "Fotografía",
  carousel: "Carrusel",
};

const STATUS_TONES: Record<string, "success" | "danger" | "warning" | "muted" | "orange"> = {
  completed: "success",
  failed: "danger",
  processing: "orange",
  pending: "warning",
};

export default function AdminCreations() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailAbortRef = useRef<AbortController | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setFailed(false);
    setError("");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const params = new URLSearchParams({
      page: String(p),
      pageSize: "20",
    });
    if (debounced.trim()) params.set("q", debounced.trim());
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/admin/creations?${params}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudo cargar la lista de creaciones."));
      }
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [debounced, statusFilter]);

  useEffect(() => {
    void load(page);
    return () => abortRef.current?.abort();
  }, [load, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const openDetail = useCallback(async (id: string) => {
    setDetailError("");
    setDetail(null);
    setDetailLoading(true);
    detailAbortRef.current?.abort();
    const ctrl = new AbortController();
    detailAbortRef.current = ctrl;
    try {
      const res = await fetch(`/api/admin/creations/${id}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudo cargar el detalle."));
      }
      setDetail((await res.json()) as Detail);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    detailAbortRef.current?.abort();
  }, []);

  // Loading (sin datos aún)
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" aria-hidden="true" />
        Cargando creaciones…
      </div>
    );
  }

  // Error (sin datos aún)
  if (failed && !data) {
    return (
      <ErrorBanner message={error} onRetry={() => void load(page)} />
    );
  }

  const rows = data?.items ?? [];
  const total = data?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {total} creación(es)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-mist/20 bg-ink px-3 py-2 text-sm text-white focus:border-brand-orange focus:outline-none"
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            <option value="completed">Completadas</option>
            <option value="failed">Fallidas</option>
            <option value="processing">Procesando</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">
            <span className="sr-only">Buscar por título o correo</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Título o correo…"
              className="w-56 rounded-xl border border-mist/20 bg-ink px-3 py-2 text-sm text-white placeholder:text-muted/70 focus:border-brand-orange focus:outline-none"
            />
          </label>
        </div>
      </div>

      {/* Tabla ≥ sm */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mist/10 text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Título</th>
              <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
              <th scope="col" className="px-4 py-3 font-medium">Plataforma</th>
              <th scope="col" className="px-4 py-3 font-medium">Usuario</th>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Fecha</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  No hay creaciones que coincidan.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-mist/5 last:border-0">
                  <td className="max-w-[360px] truncate px-4 py-3 font-medium text-white">
                    {c.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-mist">
                    {TYPE_LABELS[c.type] ?? c.type}
                  </td>
                  <td className="px-4 py-3 text-mist">{c.platform ?? "—"}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-mist">{c.userEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={STATUS_TONES[c.status] ?? "muted"}>
                      {c.status}
                    </StatusChip>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(c.id)}
                      className="whitespace-nowrap rounded-lg border border-brand-orange/40 px-3 py-1.5 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards < sm */}
      <div className="grid grid-cols-1 gap-3 sm:hidden">
        {rows.length === 0 && (
          <EmptyState label="No hay creaciones que coincidan." />
        )}
        {rows.map((c) => (
          <div key={c.id} className="rounded-2xl border border-mist/10 bg-night/40 p-4">
            <p className="font-semibold text-white">{c.title ?? "Sin título"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip tone={STATUS_TONES[c.type] ?? "muted"}>
                {TYPE_LABELS[c.type] ?? c.type}
              </StatusChip>
              <StatusChip tone={STATUS_TONES[c.status] ?? "muted"}>
                {c.status}
              </StatusChip>
            </div>
            <p className="mt-2 text-xs text-muted">
              {c.userEmail ?? "—"} · {fmtDate(c.createdAt)}
            </p>
            {c.errorMessage && (
              <p className="mt-2 text-xs text-danger">{c.errorMessage}</p>
            )}
            <button
              type="button"
              onClick={() => void openDetail(c.id)}
              className="mt-3 rounded-lg border border-brand-orange/40 px-3 py-1.5 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
            >
              Ver detalle
            </button>
          </div>
        ))}
      </div>

      {/* Paginación */}
      {total > 20 && (
        <div className="flex items-center justify-between gap-3 pt-2 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-mist/20 px-4 py-2 text-xs text-mist disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-muted" aria-live="polite">
            Página {data?.page ?? 1} · {total} en total
          </span>
          <button
            type="button"
            disabled={!data?.hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-mist/20 px-4 py-2 text-xs text-mist disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Panel de detalle */}
      {detailLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted" role="status">
          <Spinner className="h-8 w-8" />
          Cargando detalle…
        </div>
      )}
      {detailError && !detail && (
        <ErrorBanner message={detailError} onRetry={closeDetail} />
      )}
      {detail && !detailLoading && (
        <div className="rounded-2xl border border-mist/10 bg-night/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                {detail.title ?? "Detalle de creación"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {fmtDate(detail.createdAt)} · {detail.userEmail ?? "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDetail}
              className="rounded-lg border border-mist/20 px-3 py-1.5 text-xs text-mist hover:text-white"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoCell label="Tipo" value={TYPE_LABELS[detail.type] ?? detail.type} />
            <InfoCell label="Plataforma" value={detail.platform ?? "—"} />
            <InfoCell label="Modelo" value={detail.model ?? "—"} />
            <InfoCell label="Estado" value={detail.status} />
          </div>

          {detail.errorMessage && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              <strong>Error:</strong> {detail.errorMessage}
            </div>
          )}

          <div className="mt-4 space-y-4">
            {detail.input && Object.keys(detail.input).length > 0 && (
              <PreBlock title="Entrada (input)" data={detail.input} />
            )}
            {detail.output && Object.keys(detail.output).length > 0 && (
              <PreBlock title="Salida (output)" data={detail.output} />
            )}
            {!detail.input && !detail.output && (
              <p className="text-sm text-muted">Sin contenido de entrada o salida.</p>
            )}
          </div>
        </div>
      )}

      <LiveStatus text={failed ? "Error al cargar creaciones." : data ? "Lista de creaciones actualizada." : "Cargado en curso."} />
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function PreBlock({ title, data }: { title: string; data: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  const copy = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackCopy = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-mist/20 px-3 py-1 text-xs text-mist hover:text-white"
        >
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-mist/10 bg-ink p-3 text-xs text-mist">
        {text}
      </pre>
    </div>
  );
}
