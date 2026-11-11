"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiErrorMessage,
  EmptyState,
  ErrorBanner,
  LiveStatus,
  Spinner,
  StatusChip,
  fmtDate,
} from "./ui";

/**
 * Sección de Usuarios y Contratos del Panel (F2-4 / F2-4c).
 *
 * - Tabla paginada con búsqueda por nombre / correo / rol.
 * - Acciones por fila según la matriz F2-4c:
 *     · Todos los correos: revocar admin (si es admin) y desactivar.
 *     · Solo el correo propio (ADMIN_EMAILS): hacer admin y reactivar.
 * - Modal de confirmación para cada acción de cambio de estado.
 * - Estados de carga, vacío, error y feedback de acción con aria-live.
 *
 * Los correos administradores se obtienen en tiempo real de
 * /api/admin/users (carga del backend desde ADMIN_EMAILS) para que la
 * UI refleje siempre la configuración real de producción o E2E (e2e.admin@example.com).
 */

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
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  selfEmail?: string | null;
};

const PAGE_SIZE = 12;

export default function UsersSection() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState("");

  type PendingAction = {
    id: string;
    name: string;
    kind: "makeAdmin" | "revokeAdmin" | "reactivate" | "deactivate";
  };
  const [pending, setPending] = useState<PendingAction | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    setError("");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(PAGE_SIZE),
    });
    const trimmed = q.trim();
    if (trimmed) params.set("q", trimmed);
    try {
      const res = await fetch(`/api/admin/users?${params}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          apiErrorMessage(body, "No se pudo cargar la lista de usuarios.")
        );
      }
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, debounced);
    return () => abortRef.current?.abort();
  }, [load, page, debounced]);

  // Búsqueda con debounce: 1 llamada por cambio estabilizado, no por keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const isSelf = (email: string) =>
    Boolean(data?.selfEmail) &&
    email.trim().toLowerCase() ===
      (data!.selfEmail as string).trim().toLowerCase();

  const act = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyRow(id);
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            apiErrorMessage(json, "La acción no se pudo completar.")
          );
        }
        return json as { user?: { role?: string; active?: boolean } };
      } finally {
        setBusyRow(null);
      }
    },
    []
  );

  const pendingPatch = (p: PendingAction): Record<string, unknown> => {
    switch (p.kind) {
      case "makeAdmin":
        return { role: "admin" };
      case "revokeAdmin":
        return { role: "user" };
      case "reactivate":
        return { active: true };
      case "deactivate":
        return { active: false };
    }
  };

  const pendingLabel = (p: PendingAction) => {
    switch (p.kind) {
      case "makeAdmin":
        return `Hacer administrador a ${p.name}`;
      case "revokeAdmin":
        return `Revocar el acceso de administrador de ${p.name}`;
      case "reactivate":
        return `Reactivar la cuenta de ${p.name}`;
      case "deactivate":
        return `Desactivar la cuenta de ${p.name}`;
    }
  };

  const pendingDescription = (p: PendingAction) => {
    switch (p.kind) {
      case "makeAdmin":
        return "El usuario podrá entrar al panel de administración y gestionar otros usuarios. Esta acción se puede revertir desde la misma tabla.";
      case "revokeAdmin":
        return "El usuario perderá el acceso al panel de administración, pero conservará su cuenta de usuario normal y sus creaciones.";
      case "reactivate":
        return "La cuenta volverá a poder iniciar sesión y usar el servicio. Sus creaciones anteriores se conservan.";
      case "deactivate":
        return "La cuenta dejará de poder iniciar sesión ni generar contenido. Sus creaciones anteriores se conservan.";
    }
  };

  const confirmPending = useCallback(async () => {
    if (!pending) return;
    const label = pendingLabel(pending);
    try {
      const json = await act(
        pending.id,
        pendingPatch(pending)
      );
      // Refresca la fila: usa el estado devuelto para el mensaje y recarga
      // la página actual solo si cambió un valor visible.
      const u = json.user;
      if (u && (u.role || u.active !== undefined)) {
        if (u.active !== undefined && u.active === false && isSelf(pending.name) === false) {
          /* el mensaje genérico ya cubre el caso; no hacemos nada extra */
        }
      }
      setLastAction(`${label}: completado.`);
      void load(page, debounced);
      setPending(null);
    } catch (e) {
      setLastAction(`Error al ${label.toLowerCase()}: ${(e as Error).message}`);
      // Conservamos `pending` abierto para que el usuario pueda reintentar.
    }
  }, [pending, act, page, debounced, load, isSelf]);

  if (loading && !data) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted"
        role="status"
      >
        <Spinner className="h-6 w-6 text-brand-orange" />
        Cargando usuarios…
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorBanner
        message={error}
        onRetry={() => void load(page, debounced)}
      />
    );
  }

  const rows = data?.items ?? [];
  const rowsAreStale = loading && data !== null;

  const selfEmail = data?.selfEmail?.trim().toLowerCase() ?? null;

  const renderActions = (u: UserRow) => {
    const self = isSelf(u.email);
    const buttons: React.ReactNode[] = [];
    const disabled = busyRow !== null;

    // Hacer admin — SOLO para el correo propio de ADMIN_EMAILS.
    if (self) {
      buttons.push(
        <button
          key="make-admin"
          type="button"
          disabled={disabled}
          onClick={() =>
            setPending({ id: u.id, name: u.name, kind: "makeAdmin" })
          }
          className="rounded-lg border border-mist/20 px-3 py-1.5 text-xs font-medium text-mist transition hover:border-success/60 hover:text-success disabled:opacity-50"
        >
          Hacer admin
        </button>
      );
    }

    // Revocar admin — disponible para TODOS los correos si están admin
    // (la UI permite la revocación propia; los cambios de rol solo se
    // aplican si el correo está dentro de ADMIN_EMAILS según el backend).
    if (u.role === "admin") {
      buttons.push(
        <button
          key="revoke-admin"
          type="button"
          disabled={disabled}
          onClick={() =>
            setPending({ id: u.id, name: u.name, kind: "revokeAdmin" })
          }
          className="rounded-lg border border-warning/40 px-3 py-1.5 text-xs font-medium text-warning transition hover:border-warning hover:text-white disabled:opacity-50"
        >
          Revocar admin
        </button>
      );
    }

    // Reactivar — SOLO para el correo propio de ADMIN_EMAILS si está inactivo.
    if (self && !u.active) {
      buttons.push(
        <button
          key="reactivate"
          type="button"
          disabled={disabled}
          onClick={() =>
            setPending({ id: u.id, name: u.name, kind: "reactivate" })
          }
          className="rounded-lg border border-success/40 px-3 py-1.5 text-xs font-medium text-success transition hover:border-success hover:text-white disabled:opacity-50"
        >
          Reactivar
        </button>
      );
    }

    // Desactivar — TODOS los correos, incluidos los propios de ADMIN_EMAILS.
    if (u.active) {
      buttons.push(
        <button
          key="deactivate"
          type="button"
          disabled={disabled}
          onClick={() =>
            setPending({ id: u.id, name: u.name, kind: "deactivate" })
          }
          className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
        >
          Desactivar
        </button>
      );
    }

    if (buttons.length === 0) {
      return (
        <span className="text-xs text-muted" aria-label="Sin acciones disponibles">
          —
        </span>
      );
    }
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {buttons}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de herramientas: total + búsqueda + refresh manual */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {data ? `${data.count} usuario(s) registrados` : "—"}
          {selfEmail && (
            <span className="ml-2 hidden sm:inline">
              · Correo propio administrador:{" "}
              <span className="font-mono text-xs">{selfEmail}</span>
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            <span className="sr-only">Buscar por nombre, correo o rol</span>
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, correo o rol…"
              className="w-full rounded-lg border border-mist/20 bg-ink px-3 py-2 text-sm text-white placeholder-mist/50 focus:border-brand-orange focus:outline-none sm:w-56"
            />
          </label>
          <button
            type="button"
            onClick={() => void load(page, debounced)}
            disabled={rowsAreStale || busyRow !== null}
            aria-label="Recargar lista de usuarios"
            className="rounded-lg border border-mist/20 px-3 py-2 text-sm text-mist transition hover:border-brand-orange/60 hover:text-white disabled:opacity-40"
          >
            <span aria-hidden="true" className={rowsAreStale ? "inline-block animate-spin" : ""}>
              ⟳
            </span>
          </button>
        </div>
      </div>

      <div
        className={`overflow-x-auto rounded-2xl border border-mist/10 transition-opacity ${
          rowsAreStale ? "opacity-60" : ""
        }`}
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-mist/10 text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Usuario</th>
              <th scope="col" className="px-4 py-3 font-medium">Correo</th>
              <th scope="col" className="px-4 py-3 font-medium">Rol</th>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Creaciones</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Último acceso</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState label="No hay usuarios que coincidan con la búsqueda." />
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-mist/5 last:border-0">
                <td className="px-4 py-3 font-medium text-white">
                  <div className="flex items-center gap-2">
                    <span>{u.name}</span>
                    {isSelf(u.email) && (
                      <span
                        className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success"
                        aria-label="Correo propio administrador (ADMIN_EMAILS)"
                      >
                        PROPIO
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-mist">{u.email}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusChip tone={u.role === "admin" ? "orange" : "muted"}>
                    {u.role === "admin" ? "Administrador" : "Usuario"}
                  </StatusChip>
                </td>
                <td className="px-4 py-3">
                  <StatusChip tone={u.active ? "success" : "danger"}>
                    {u.active ? "Activo" : "Desactivado"}
                  </StatusChip>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {u.nCreaciones}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted">
                  {fmtDate(u.lastLoginAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">{renderActions(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {data && data.count > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1 || rowsAreStale}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-mist/20 px-3 py-1.5 text-xs text-mist disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-muted">
            Página {data.page} · {data.count} en total
          </span>
          <button
            type="button"
            disabled={!data.hasMore || rowsAreStale}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-mist/20 px-3 py-1.5 text-xs text-mist disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Aviso de error de refresco sin perder la tabla actual */}
      {error && data !== null && (
        <ErrorBanner
          title="No se pudo refrescar la lista"
          message={error}
          onRetry={() => void load(page, debounced)}
        />
      )}

      <LiveStatus text={lastAction} />

      {/* Modal de confirmación para acciones con cambio de estado */}
      {pending && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:inset-0 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={pendingLabel(pending)}
        >
          <div
            className="absolute inset-0 -z-10 bg-ink/80 backdrop-blur-sm"
            aria-hidden="true"
          />
          <div className="w-full max-w-md rounded-2xl border border-mist/10 bg-night p-6">
            <h3 className="text-base font-semibold text-white">
              {pendingLabel(pending)}
            </h3>
            <p className="mt-2 text-sm text-muted">{pendingDescription(pending)}</p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-mist/20 px-4 py-2 text-sm font-medium text-mist hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmPending()}
                disabled={busyRow !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-coral disabled:opacity-50"
              >
                {busyRow !== null && <Spinner className="h-3.5 w-3.5" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Nota: los correos dentro de la lista administradora (ADMIN_EMAILS)
        siempre conservan su rol <span className="font-mono">admin</span>. La
        opción «Revocar admin» sobre el propio correo no aplica el cambio en
        base de datos; sí se puede desactivar su cuenta desde esta tabla.
      </p>
    </div>
  );
}
