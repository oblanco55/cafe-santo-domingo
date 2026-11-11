"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, ErrorBanner, LiveStatus, Spinner } from "./ui";

type Settings = {
  limits: {
    creationsPer10Min: number;
    freeCreationsPerMonth: number;
  };
};

const inputCls =
  "w-full rounded-xl border border-mist/20 bg-ink px-3 py-2 text-sm text-white focus:border-brand-orange focus:outline-none";

export default function AdminAjustes() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [creationsPer10MinDraft, setCreationsPer10MinDraft] = useState("5");

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/admin/settings", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudieron cargar los ajustes."));
      }
      const json = (await res.json()) as { settings: Settings };
      setSettings(json.settings);
      setCreationsPer10MinDraft(String(json.settings.limits.creationsPer10Min));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const save = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          limits: {
            creationsPer10Min: Math.max(1, Math.min(200, Number(creationsPer10MinDraft) || 5)),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudieron guardar los ajustes."));
      }
      const json = (await res.json()) as { settings: Settings };
      setSettings(json.settings);
      setCreationsPer10MinDraft(String(json.settings.limits.creationsPer10Min));
      setSavedMsg("Ajustes guardados correctamente.");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [settings, creationsPer10MinDraft]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" aria-hidden="true" />
        Cargando ajustes…
      </div>
    );
  }

  if (error && !settings) {
    return <ErrorBanner message={error} onRetry={() => void load()} />;
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl border border-mist/10 bg-night/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Límites de creación</h2>
          <LiveStatus text={savedMsg || "Ajustes listos."} />
        </div>

        <div className="mt-4 space-y-4">
          {/* Creations per 10 min */}
          <div>
            <label htmlFor="adj-creations-10min" className="block text-sm font-medium text-white">
              Creaciones por usuario cada 10 minutos
            </label>
            <p className="mt-0.5 text-xs text-muted">
              Límite de creaciones que un usuario puede iniciar en 10 minutos.
            </p>
            <input
              id="adj-creations-10min"
              type="number"
              min={1}
              max={200}
              value={creationsPer10MinDraft}
              onChange={(e) => setCreationsPer10MinDraft(e.target.value)}
              className={`mt-2 ${inputCls} max-w-xs`}
            />
          </div>

          <p className="text-xs text-muted">
            La capa gratuita (creaciones gratis al mes) se configura en{" "}
            <a href="/admin/monetizacion" className="text-brand-orange hover:underline">Monetización</a>.
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        {savedMsg && (
          <div role="status" className="mt-4 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
            {savedMsg}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-coral disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Guardando…
              </span>
            ) : (
              "Guardar ajustes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
