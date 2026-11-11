"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  nCreaciones: number;
};

type ApiResponse = {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

const PAGE_SIZE = 12;
/**
 * Si la sesión actual coincide con uno de estos correos no se le permiten
 * auto-desactivar ni quitarse el rol de admin a sí misma. El frontend
 * resuelve el conflicto de estado; la autorización final vive en el
 * backend (F2-3).
 */
const E2E_SELF_EMAIL = "e2e.admin@example.com";

export default function AdminUsuarios() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    setFailed(false);
    setError("");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(PAGE_SIZE),
      q: q.trim(),
    });
    try {
      const res = await fetch(`/api/admin/users?${params}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ??
            "No se pudo cargar la lista de usuarios."
        );
      }
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, debounced);
    return () => abortRef.current?.abort();
  }, [load, page, debounced]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const change = useCallback(async (row: UserRow, patch: { role?: "user" | "admin"; active?: boolean }) => {
    const isSelf = row.email.trim().toLowerCase() === E2E_SELF_EMAIL;
    const willDemoteSelf = isSelf && patch.role === "user";
    const willDeactivateSelf = isSelf && patch.active === false;
    if (willDemoteSelf || willDeactivateSelf) {
      setActionError("No puedes modificar tu propia cuenta.");
      setTimeout(() => setActionError(""), 4000);
      return;
    }

    const msg =
      patch.role !== undefined
        ? patch.role === "admin"
          ? `¿Convierte a ${row.name} en administrador?`
          : `¿Quita el rol de admin a ${row.name}?`
        : patch.active
          ? `¿Reactiva la cuenta de ${row.name}?`
          : `¿Desactiva la cuenta de ${row.name}?`;
    if (!window.confirm(msg)) return;

    setBusyId(row.id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ?? "La acción no se pudo completar."
        );
      }
      await load(page, debounced);
    } catch (e) {
      setActionError((e as Error).message);
      setTimeout(() => setActionError(""), 5000);
    } finally {
      setBusyId(null);
    }
  }, [load, page, debounced]);

  /* --- Loading (sin datos aún) --- */
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" aria-hidden="true" />
        Cargando usuarios…
      </div>
    );
  }

  /* --- Error (sin datos aún) --- */
  if (failed && !data) {
    return (
      <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-5">
        <h2 className="text-sm font-semibold text-danger">Hubo un problema</h2>
        <p className="mt-1 text-sm text-mist">{error}</p>
        <button
          type="button"
          onClick={() => void load(page, debounced)}
          className="mt-3 rounded-lg border border-mist/20 px-4 py-2 text-sm font-medium text-mist hover:text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {total} usuario(s) registrados
          </p>
          <a
            href="/api/admin/leads-export"
            download
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition"
            title="Descargar base de datos de leads de Café Santo Domingo en CSV"
          >
            📊 Exportar Leads (Excel / CSV)
          </a>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="sr-only">Buscar usuario por nombre o correo</span>
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 4 4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o correo…"
            className="w-64 rounded-xl border border-mist/20 bg-ink px-3 py-2 text-sm text-white placeholder:text-muted/70 focus:border-brand-orange focus:outline-none"
          />
        </label>
      </div>

      {actionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger"
        >
          {actionError}
        </div>
      )}

      {/* Tabla ≥ sm, tarjetas < sm */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mist/10 text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Usuario</th>
              <th scope="col" className="px-4 py-3 font-medium">Correo</th>
              <th scope="col" className="px-4 py-3 font-medium">Rol</th>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Creaciones</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Último acceso</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  No hay usuarios que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-b border-mist/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                  <td className="px-4 py-3 text-mist">{u.email}</td>
                  <td className="px-4 py-3">
                    <Chip tone={u.role === "admin" ? "orange" : "muted"}>
                      {u.role === "admin" ? "Admin" : "Usuario"}
                    </Chip>
                  </td>
                  <td className="px-4 py-3">
                    <Chip tone={u.active ? "success" : "danger"}>
                      {u.active ? "Activo" : "Desactivado"}
                    </Chip>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.nCreaciones}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <ActionButton
                        busy={busyId === u.id}
                        tone={u.role === "admin" ? "neutral" : "brand"}
                        onClick={() =>
                          void change(u, { role: u.role === "admin" ? "user" : "admin" })
                        }
                      >
                        {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                      </ActionButton>
                      <ActionButton
                        busy={busyId === u.id}
                        tone={u.active ? "danger" : "success"}
                        onClick={() => void change(u, { active: !u.active })}
                      >
                        {u.active ? "Desactivar" : "Activar"}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:hidden">
        {rows.length === 0 && (
          <p className="rounded-xl border border-mist/10 bg-ink px-4 py-6 text-center text-sm text-muted">
            No hay usuarios que coincidan con la búsqueda.
          </p>
        )}
        {rows.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            busy={busyId === u.id}
            onRole={(next) => void change(u, { role: next })}
            onActive={(next) => void change(u, { active: next })}
          />
        ))}
      </div>

      {total > PAGE_SIZE && (
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
    </div>
  );
}

function UserCard({
  user: u,
  busy,
  onRole,
  onActive,
}: {
  user: UserRow;
  busy: boolean;
  onRole: (r: "user" | "admin") => void;
  onActive: (v: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-mist/10 bg-night/40 p-4">
      <p className="font-semibold text-white">{u.name}</p>
      <p className="mt-0.5 text-sm text-muted">{u.email}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Chip tone={u.role === "admin" ? "orange" : "muted"}>
          {u.role === "admin" ? "Admin" : "Usuario"}
        </Chip>
        <Chip tone={u.active ? "success" : "danger"}>
          {u.active ? "Activo" : "Desactivado"}
        </Chip>
        <span className="text-xs text-muted">
          {u.nCreaciones} creaciones
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Última sesión: {fmtDate(u.lastLoginAt)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActionButton
          busy={busy}
          tone={u.role === "admin" ? "neutral" : "brand"}
          onClick={() => onRole(u.role === "admin" ? "user" : "admin")}
        >
          {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
        </ActionButton>
        <ActionButton
          busy={busy}
          tone={u.active ? "danger" : "success"}
          onClick={() => onActive(!u.active)}
        >
          {u.active ? "Desactivar" : "Activar"}
        </ActionButton>
      </div>
    </div>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "success" | "danger" | "orange" | "muted";
  children: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
    orange: "bg-brand-orange/15 text-brand-orange",
    muted: "bg-mist/10 text-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[tone]}`}
    >
      {children}
    </span>
  );
}

function ActionButton({
  tone,
  busy,
  onClick,
  children,
}: {
  tone: "brand" | "neutral" | "danger" | "success";
  busy: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    brand: "border-brand-orange/40 text-brand-orange hover:bg-brand-orange/10",
    neutral: "border-mist/20 text-mist hover:text-white",
    danger: "border-danger/40 text-danger hover:bg-danger/10",
    success: "border-success/40 text-success hover:bg-success/10",
  };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${cls[tone]}`}
    >
      {busy && (
        <span
          className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
