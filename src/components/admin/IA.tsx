"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, ErrorBanner, LiveStatus, Spinner, StatusChip, EmptyState, fmtDate } from "./ui";

type Provider = {
  id: string;
  label: string;
  kind: "anthropic" | "openai_compatible";
  baseUrl: string | null;
  model: string;
  apiKeyMasked: string | null;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

type Preset = {
  id: string;
  label: string;
  kind: string;
  baseUrl: string | null;
  model: string;
  priority: number;
};

type TestResult = {
  success: boolean;
  message: string;
  latencyMs: number | null;
};

const KIND_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai_compatible: "OpenAI-compatible",
};

export default function AdminIA() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const pc = await fetch("/api/admin/ai/providers", {
      cache: "no-store",
      signal: ctrl.signal,
    });
    const ps = await fetch("/api/admin/ai/presets", {
      cache: "no-store",
      signal: ctrl.signal,
    });
    try {
      if (!pc.ok) {
        const body = await pc.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudieron cargar los proveedores."));
      }
      const pJson = ((await pc.json()).providers ?? []) as Provider[];
      setProviders(pJson);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setLoading(false);
      return;
    }
    if (ps.ok) {
      // La API devuelve defaultModel; el formulario usa model/priority.
      const psJson = (((await ps.json()).presets ?? []) as Array<Preset & { defaultModel?: string }>).map(
        (p) => ({ ...p, model: p.model ?? p.defaultModel ?? "", priority: p.priority ?? 100 }),
      );
      setPresets(psJson);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" aria-hidden="true" />
        Cargando proveedores de IA…
      </div>
    );
  }

  if (error && providers.length === 0) {
    return <ErrorBanner message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {providers.length === 0
            ? "No hay proveedores de IA configurados."
            : `${providers.length} proveedor(es) configurado(s)`}
        </p>
      </div>

      {providers.length === 0 ? (
        <div className="space-y-6">
          <EmptyState label="Configura tu primer proveedor de IA abajo." />
          <ProviderForm presets={presets} onCreated={() => void load()} />
          {presets.length > 0 && (
            <PresetsSection presets={presets} onApplied={() => void load()} />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <ProvidersTable
            providers={providers}
            onRefresh={() => void load()}
          />
          <h2 className="text-sm font-semibold text-white">Añadir proveedor</h2>
          <ProviderForm presets={presets} onCreated={() => void load()} />
          {presets.length > 0 && (
            <PresetsSection presets={presets} onApplied={() => void load()} />
          )}
        </div>
      )}

      <LiveStatus text={loading ? "Cargando proveedores." : "Lista de proveedores actualizada."} />
    </div>
  );
}

function ProvidersTable({
  providers,
  onRefresh,
}: {
  providers: Provider[];
  onRefresh: () => void;
}) {
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const test = useCallback(async (id: string) => {
    setTestingId(id);
    setTestResults((prev) => ({ ...prev, [id]: null }));
    try {
      const res = await fetch(`/api/admin/ai/providers/${id}/test`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as TestResult & { error?: { message?: string } };
      if (!res.ok) {
        setTestResults((prev) => ({
          ...prev,
          [id]: {
            success: false,
            message: body?.error?.message ?? "No se pudo ejecutar la prueba.",
            latencyMs: null,
          },
        }));
      } else {
        setTestResults((prev) => ({ ...prev, [id]: body as TestResult }));
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: false,
          message: "Error de red al probar el proveedor.",
          latencyMs: null,
        },
      }));
    } finally {
      setTestingId(null);
    }
  }, []);

  const toggle = useCallback(async (p: Provider, patch: Partial<Provider>) => {
    try {
      const res = await fetch(`/api/admin/ai/providers/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudo actualizar el proveedor."));
      }
      onRefresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [onRefresh]);

  const remove = useCallback(async (p: Provider) => {
    if (!window.confirm(`¿Eliminar el proveedor «${p.label}»? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/ai/providers/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudo eliminar el proveedor."));
      }
      onRefresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [onRefresh]);

  return (
    <div className="space-y-3">
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mist/10 text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Proveedor</th>
              <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
              <th scope="col" className="px-4 py-3 font-medium">Modelo</th>
              <th scope="col" className="px-4 py-3 font-medium">Prioridad</th>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const result = testResults[p.id];
              const isTesting = testingId === p.id;
              return (
                <>
                  <tr key={p.id} className="border-b border-mist/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{p.label}</p>
                      {p.apiKeyMasked && (
                        <p className="mt-0.5 text-xs text-muted">API key: {p.apiKeyMasked}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-mist">{KIND_LABELS[p.kind] ?? p.kind}</td>
                    <td className="max-w-[320px] truncate px-4 py-3 text-mist">{p.model}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.priority}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusChip tone={p.enabled ? "success" : "muted"}>
                          {p.enabled ? "Activo" : "Inactivo"}
                        </StatusChip>
                        {p.isDefault && <StatusChip tone="orange">Predeterminado</StatusChip>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isTesting}
                          onClick={() => void test(p.id)}
                          className="rounded-lg border border-mist/20 px-3 py-1.5 text-xs text-mist hover:text-white disabled:opacity-50"
                        >
                          {isTesting ? <Spinner className="h-3 w-3" /> : "Probar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggle(p, { enabled: !p.enabled })}
                          className="rounded-lg border border-brand-orange/40 px-3 py-1.5 text-xs text-brand-orange hover:bg-brand-orange/10"
                        >
                          {p.enabled ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                          className="rounded-lg border border-mist/20 px-3 py-1.5 text-xs text-mist hover:text-white"
                        >
                          {editingId === p.id ? "Cancelar" : "Editar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(p)}
                          className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === p.id && (
                    <tr key={`${p.id}-edit`}>
                      <td colSpan={6} className="px-4 py-4">
                        <EditForm provider={p} onSaved={() => { setEditingId(null); onRefresh(); }} onCancel={() => setEditingId(null)} />
                      </td>
                    </tr>
                  )}
                  {result && (
                    <tr key={`${p.id}-test`}>
                      <td colSpan={6} className="px-4 py-2">
                        <TestResultBadge result={result} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:hidden">
        {providers.map((p) => {
          const result = testResults[p.id];
          const isTesting = testingId === p.id;
          return (
            <div key={p.id} className="rounded-2xl border border-mist/10 bg-night/40 p-4">
              <p className="font-semibold text-white">{p.label}</p>
              <p className="mt-0.5 text-xs text-muted">
                {KIND_LABELS[p.kind] ?? p.kind} · {p.model}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusChip tone={p.enabled ? "success" : "muted"}>
                  {p.enabled ? "Activo" : "Inactivo"}
                </StatusChip>
                {p.isDefault && <StatusChip tone="orange">Predeterminado</StatusChip>}
                <span className="text-xs text-muted">Prio: {p.priority}</span>
              </div>
              {p.apiKeyMasked && (
                <p className="mt-1 text-xs text-muted">Key: {p.apiKeyMasked}</p>
              )}
              {result && <div className="mt-2"><TestResultBadge result={result} /></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => void test(p.id)}
                  className="rounded-lg border border-mist/20 px-3 py-1.5 text-xs text-mist hover:text-white disabled:opacity-50"
                >
                  {isTesting ? <Spinner className="h-3 w-3" /> : "Probar"}
                </button>
                <button
                  type="button"
                  onClick={() => void toggle(p, { enabled: !p.enabled })}
                  className="rounded-lg border border-brand-orange/40 px-3 py-1.5 text-xs text-brand-orange hover:bg-brand-orange/10"
                >
                  {p.enabled ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(p)}
                  className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10"
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TestResultBadge({ result }: { result: TestResult }) {
  if (result.success) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5 text-xs text-success">
        ✓ Conectado con éxito
        {result.latencyMs !== null && (
          <span className="text-success/70">({result.latencyMs} ms)</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger">
      ✗ {result.message}
    </span>
  );
}

function ProviderForm({
  presets,
  onCreated,
}: {
  presets: Preset[];
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"anthropic" | "openai_compatible">("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [priority, setPriority] = useState(100);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // «Escribir manualmente»: formulario vacío para cualquier proveedor compatible con OpenAI.
  const startManual = useCallback(() => {
    setLabel("");
    setKind("openai_compatible");
    setBaseUrl("");
    setModel("");
    setPriority(100);
    document.getElementById("nuevo-proveedor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => document.getElementById("prov-label")?.focus(), 300);
  }, []);

  useEffect(() => {
    window.addEventListener("ia:manual", startManual);
    return () => window.removeEventListener("ia:manual", startManual);
  }, [startManual]);

  const applyPreset = useCallback((preset: Preset) => {
    setLabel(preset.label);
    setKind(preset.kind as "anthropic" | "openai_compatible");
    setBaseUrl(preset.baseUrl ?? "");
    setModel(preset.model);
    setPriority(preset.priority);
  }, []);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        label: label.trim(),
        kind,
        model: model.trim(),
        priority,
        isDefault,
        enabled: true,
      };
      if (baseUrl.trim()) payload.baseUrl = baseUrl.trim();
      if (apiKey.trim()) payload.apiKey = apiKey.trim();

      const res = await fetch("/api/admin/ai/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudo crear el proveedor."));
      }
      setLabel("");
      setBaseUrl("");
      setModel("");
      setApiKey("");
      setPriority(100);
      setIsDefault(false);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [label, kind, model, baseUrl, apiKey, priority, isDefault, onCreated]);

  return (
    <div id="nuevo-proveedor" className="scroll-mt-6 rounded-2xl border border-mist/10 bg-night/40 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">Añadir proveedor</h3>
      {presets.length > 0 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-muted">Plantillas rápidas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-lg border border-brand-orange/30 px-3 py-1.5 text-xs text-brand-orange hover:bg-brand-orange/10"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={startManual}
              className="rounded-lg border border-mist/30 px-3 py-1.5 text-xs text-white hover:bg-mist/10"
            >
              ✍️ Escribir manualmente
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            ¿Tu proveedor no está en la lista? Usa «Escribir manualmente» con su URL base compatible con OpenAI, el modelo y la clave.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Etiqueta" htmlFor="prov-label">
            <input
              id="prov-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="Ej: Anthropic trabajo"
              className={inputCls}
            />
          </Field>
          <Field label="Tipo" htmlFor="prov-kind">
            <select
              id="prov-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as "anthropic" | "openai_compatible")}
              className={inputCls}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai_compatible">OpenAI-compatible</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kind === "openai_compatible" && (
            <Field label="Base URL" htmlFor="prov-url">
              <input
                id="prov-url"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.miproveedor.com/v1"
                className={inputCls}
              />
            </Field>
          )}
          <Field label="Modelo" htmlFor="prov-model">
            <input
              id="prov-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              placeholder="Ej: claude-sonnet-4-20250514"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="API Key (opcional)" htmlFor="prov-key">
            <input
              id="prov-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              className={inputCls}
              autoComplete="off"
            />
          </Field>
          <Field label="Prioridad" htmlFor="prov-prio">
            <input
              id="prov-prio"
              type="number"
              min={1}
              max={10000}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 100)}
              className={inputCls}
            />
          </Field>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-mist">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-mist/30 bg-ink text-brand-orange focus:ring-brand-orange"
              />
              Predeterminado
            </label>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-coral disabled:opacity-50"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Creando…
            </span>
          ) : (
            "Crear proveedor"
          )}
        </button>
      </form>
    </div>
  );
}

function EditForm({
  provider,
  onSaved,
  onCancel,
}: {
  provider: Provider;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(provider.label);
  const [model, setModel] = useState(provider.model);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [priority, setPriority] = useState(provider.priority);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (label.trim() && label.trim() !== provider.label) payload.label = label.trim();
      if (model.trim() && model.trim() !== provider.model) payload.model = model.trim();
      if (provider.kind === "openai_compatible" && baseUrl.trim() && baseUrl.trim() !== (provider.baseUrl ?? "")) {
        payload.baseUrl = baseUrl.trim();
      }
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      if (priority !== provider.priority) payload.priority = priority;
      if (Object.keys(payload).length === 0) {
        throw new Error("No hay cambios que guardar.");
      }
      const res = await fetch(`/api/admin/ai/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudo actualizar el proveedor."));
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [label, model, baseUrl, apiKey, priority, provider, onSaved]);

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-mist/10 bg-ink/50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Etiqueta" htmlFor={`edit-label-${provider.id}`}>
          <input
            id={`edit-label-${provider.id}`}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Modelo" htmlFor={`edit-model-${provider.id}`}>
          <input
            id={`edit-model-${provider.id}`}
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
      </div>
      {provider.kind === "openai_compatible" && (
        <Field label="Base URL" htmlFor={`edit-url-${provider.id}`}>
          <input
            id={`edit-url-${provider.id}`}
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className={inputCls}
          />
        </Field>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Nueva API Key (opcional)" htmlFor={`edit-key-${provider.id}`}>
          <input
            id={`edit-key-${provider.id}`}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Dejar vacío para no cambiar"
            className={inputCls}
            autoComplete="off"
          />
        </Field>
        <Field label="Prioridad" htmlFor={`edit-prio-${provider.id}`}>
          <input
            id={`edit-prio-${provider.id}`}
            type="number"
            min={1}
            max={10000}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) || 100)}
            className={inputCls}
          />
        </Field>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-coral disabled:opacity-50"
        >
          {busy ? <span className="inline-flex items-center gap-2"><Spinner /> Guardando…</span> : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-mist/20 px-4 py-2 text-sm text-mist hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PresetsSection({ presets, onApplied }: { presets: Preset[]; onApplied: () => void }) {
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const apply = useCallback(async (preset: Preset) => {
    setError("");
    setBusyId(preset.id);
    try {
      const payload: Record<string, unknown> = {
        label: preset.label,
        kind: preset.kind,
        model: preset.model,
        priority: preset.priority,
        enabled: true,
        isDefault: false,
      };
      if (preset.baseUrl) payload.baseUrl = preset.baseUrl;
      const res = await fetch("/api/admin/ai/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudo aplicar la plantilla."));
      }
      setAppliedId(preset.id);
      setTimeout(() => setAppliedId(null), 3000);
      onApplied();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }, [onApplied]);

  return (
    <div id="presets" className="rounded-2xl border border-mist/10 bg-night/40 p-5">
      <h3 className="text-sm font-semibold text-white">Plantillas de providers</h3>
      <p className="mt-1 text-xs text-muted">
        Aplica una plantilla para crear un proveedor con valores predefinidos.
      </p>
      <div className="mt-3 space-y-2">
        {presets.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-mist/10 bg-ink/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">{p.label}</p>
              <p className="mt-0.5 text-xs text-muted">
                {KIND_LABELS[p.kind] ?? p.kind} · {p.model} · Prio {p.priority}
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === p.id}
              onClick={() => void apply(p)}
              className="rounded-lg border border-brand-orange/40 px-3 py-1.5 text-xs text-brand-orange hover:bg-brand-orange/10 disabled:opacity-50"
            >
              {appliedId === p.id ? "✓ Aplicada" : busyId === p.id ? <Spinner className="h-3 w-3" /> : "Aplicar"}
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-mist/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Otro proveedor</p>
            <p className="mt-0.5 text-xs text-muted">Escribe la URL base, el modelo y la clave de cualquier IA compatible con OpenAI.</p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("ia:manual"))}
            className="shrink-0 rounded-lg border border-mist/30 px-3 py-1.5 text-xs text-white hover:bg-mist/10"
          >
            Escribir manualmente
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-mist/20 bg-ink px-3 py-2 text-sm text-white placeholder:text-muted/70 focus:border-brand-orange focus:outline-none";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-muted">{label}</label>
      {children}
    </div>
  );
}
