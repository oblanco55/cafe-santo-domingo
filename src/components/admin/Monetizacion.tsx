"use client";

import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage, EmptyState, ErrorBanner, fmtDate, Spinner, StatusChip } from "./ui";

/* ── Tipos (respuestas de /api/admin/billing/*) ─────────────────── */

type BillingSettings = {
  enabled: boolean;
  freeCreationsPerMonth: number;
  currency: string;
  currencies: string[];
  paypal: {
    mode: "sandbox" | "live";
    clientId: string;
    clientSecretMasked: string | null;
    webhookId: string;
    configured: boolean;
  };
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
  creationsPerPeriod: number | null;
  paypalPlanId: string | null;
  active: boolean;
  sortOrder: number;
};

type Pack = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  active: boolean;
  sortOrder: number;
};

type PaymentRow = {
  id: string;
  kind: "credit_pack" | "subscription";
  status: "created" | "completed" | "refunded" | "failed";
  amountCents: number;
  currency: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

/* ── Utilidades ─────────────────────────────────────────────────── */

const inputCls =
  "w-full rounded-xl border border-mist/20 bg-ink px-3 py-2 text-sm text-white focus:border-brand-orange focus:outline-none";
const btnPrimary =
  "rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-coral disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-mist/20 px-4 py-2 text-sm text-mist transition hover:border-brand-orange hover:text-white disabled:opacity-50";
const card = "rounded-2xl border border-mist/10 bg-night/40 p-5";

/** "9.99" → 999 (centavos). NaN si no es un importe válido. */
export function toCents(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
}

function fmtMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

async function api<T>(url: string, init?: RequestInit, fallback?: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiErrorMessage(body, fallback));
  return body as T;
}

function Feedback({ error, ok }: { error: string; ok: string }) {
  return (
    <>
      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}
      {ok && (
        <div role="status" className="mt-4 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          {ok}
        </div>
      )}
    </>
  );
}

function useFlash() {
  const [ok, setOk] = useState("");
  const flash = useCallback((msg: string) => {
    setOk(msg);
    setTimeout(() => setOk(""), 3000);
  }, []);
  return { ok, flash };
}

/* ── General + PayPal ───────────────────────────────────────────── */

function SettingsSection({ settings, onSaved }: { settings: BillingSettings; onSaved: (s: BillingSettings) => void }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [free, setFree] = useState(String(settings.freeCreationsPerMonth));
  const [currency, setCurrency] = useState(settings.currency);
  const [mode, setMode] = useState(settings.paypal.mode);
  const [clientId, setClientId] = useState(settings.paypal.clientId);
  const [secret, setSecret] = useState("");
  const [webhookId, setWebhookId] = useState(settings.paypal.webhookId);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const { ok, flash } = useFlash();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const json = await api<{ settings: BillingSettings }>(
        "/api/admin/billing/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            enabled,
            freeCreationsPerMonth: Math.max(0, Math.floor(Number(free) || 0)),
            currency,
            paypal: { mode, clientId: clientId.trim(), webhookId: webhookId.trim(), ...(secret.trim() ? { clientSecret: secret.trim() } : {}) },
          }),
        },
        "No se pudieron guardar los ajustes.",
      );
      setSecret("");
      onSaved(json.settings);
      flash("Ajustes de monetización guardados.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError("");
    try {
      const r = await api<{ mode: string; latencyMs: number }>("/api/admin/billing/test", { method: "POST" }, "No se pudo conectar con PayPal.");
      flash(`Conexión con PayPal correcta (${r.mode}, ${r.latencyMs} ms).`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <div className={card}>
        <h2 className="text-sm font-semibold text-white">General</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-3 text-sm text-white">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-brand-orange" />
            Cobros activados
          </label>
          <p className="-mt-2 text-xs text-muted">
            Desactivado: todos los usuarios crean sin límite. Activado: se aplica la capa gratuita, los planes y los créditos.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mon-free" className="block text-sm font-medium text-white">Creaciones gratis al mes</label>
              <input id="mon-free" type="number" min={0} value={free} onChange={(e) => setFree(e.target.value)} className={`mt-2 ${inputCls}`} />
              <p className="mt-1 text-xs text-muted">0 = sin capa gratuita.</p>
            </div>
            <div>
              <label htmlFor="mon-currency" className="block text-sm font-medium text-white">Moneda</label>
              <select id="mon-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={`mt-2 ${inputCls}`}>
                {settings.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">PayPal</h2>
          {settings.paypal.configured ? <StatusChip tone="success">Configurado</StatusChip> : <StatusChip tone="muted">Sin configurar</StatusChip>}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pp-mode" className="block text-sm font-medium text-white">Modo</label>
            <select id="pp-mode" value={mode} onChange={(e) => setMode(e.target.value as "sandbox" | "live")} className={`mt-2 ${inputCls}`}>
              <option value="sandbox">Sandbox (pruebas)</option>
              <option value="live">Live (cobros reales)</option>
            </select>
            {mode === "live" && (
              <p className="mt-1 text-xs font-semibold text-warning" role="alert">
                Cobros reales: usa credenciales Live y prueba antes todo en Sandbox.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="pp-client" className="block text-sm font-medium text-white">Client ID</label>
            <input id="pp-client" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" className={`mt-2 ${inputCls}`} />
          </div>
          <div>
            <label htmlFor="pp-secret" className="block text-sm font-medium text-white">Client Secret</label>
            <input
              id="pp-secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="new-password"
              placeholder={settings.paypal.clientSecretMasked ?? "Pega aquí el Secret"}
              className={`mt-2 ${inputCls}`}
            />
            <p className="mt-1 text-xs text-muted">Se guarda cifrado. Déjalo vacío para no cambiarlo.</p>
          </div>
          <div>
            <label htmlFor="pp-webhook" className="block text-sm font-medium text-white">Webhook ID</label>
            <input id="pp-webhook" value={webhookId} onChange={(e) => setWebhookId(e.target.value)} autoComplete="off" className={`mt-2 ${inputCls}`} />
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-mist/10 bg-ink/60 p-3 text-xs text-muted">
          URL del webhook para registrar en PayPal:
          <code className="mt-1 block break-all text-sm text-white">{origin}/api/paypal/webhook</code>
        </div>
        <button type="button" onClick={() => void test()} disabled={testing || !settings.paypal.configured} className={`mt-4 ${btnSecondary}`}>
          {testing ? <span className="inline-flex items-center gap-2"><Spinner /> Probando…</span> : "Probar conexión"}
        </button>
        {!settings.paypal.configured && <p className="mt-1 text-xs text-muted">Guarda primero el Client ID y el Secret.</p>}
      </div>

      <Feedback error={error} ok={ok} />
      <button type="submit" disabled={saving} className={btnPrimary}>
        {saving ? <span className="inline-flex items-center gap-2"><Spinner /> Guardando…</span> : "Guardar ajustes"}
      </button>
    </form>
  );
}

/* ── Planes ─────────────────────────────────────────────────────── */

const emptyPlan = { name: "", description: "", price: "", interval: "month" as "month" | "year", quota: "", unlimited: false, active: true, sortOrder: "0" };

function PlansSection({ currency }: { currency: string }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { ok, flash } = useFlash();

  const load = useCallback(async () => {
    try {
      setPlans((await api<{ plans: Plan[] }>("/api/admin/billing/plans")).plans);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const edit = (p: Plan) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: (p.priceCents / 100).toFixed(2),
      interval: p.interval,
      quota: p.creationsPerPeriod === null ? "" : String(p.creationsPerPeriod),
      unlimited: p.creationsPerPeriod === null,
      active: p.active,
      sortOrder: String(p.sortOrder),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const priceCents = toCents(form.price);
    if (Number.isNaN(priceCents)) return setError("Indica un precio válido, por ejemplo 9.99.");
    const quota = form.unlimited ? null : Math.floor(Number(form.quota));
    if (quota !== null && !(quota >= 1)) return setError("Indica cuántas creaciones incluye o marca «Ilimitado».");
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
        priceCents,
        interval: form.interval,
        creationsPerPeriod: quota,
        active: form.active,
        sortOrder: Math.floor(Number(form.sortOrder) || 0),
      });
      await api(editing ? `/api/admin/billing/plans/${editing}` : "/api/admin/billing/plans", { method: editing ? "PATCH" : "POST", body }, "No se pudo guardar el plan.");
      setForm(emptyPlan);
      setEditing(null);
      flash(editing ? "Plan actualizado." : "Plan creado.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    if (!window.confirm("¿Desactivar este plan? Los suscriptores actuales lo conservan.")) return;
    try {
      await api(`/api/admin/billing/plans/${id}`, { method: "DELETE" }, "No se pudo desactivar.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-white">Planes de suscripción</h2>
      {plans === null ? (
        <p className="mt-4 text-sm text-muted"><Spinner /> Cargando…</p>
      ) : plans.length === 0 ? (
        <EmptyState label="Aún no hay planes." />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr><th className="py-2">Nombre</th><th>Precio</th><th>Creaciones</th><th>PayPal</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-t border-mist/10 text-mist">
                  <td className="py-2 text-white">{p.name}</td>
                  <td>{fmtMoney(p.priceCents, p.currency)} / {p.interval === "year" ? "año" : "mes"}</td>
                  <td>{p.creationsPerPeriod ?? "Ilimitado"}</td>
                  <td>{p.paypalPlanId ? <StatusChip tone="success">Sincronizado con PayPal</StatusChip> : <StatusChip tone="warning">Sin sincronizar</StatusChip>}</td>
                  <td>{p.active ? <StatusChip tone="success">Activo</StatusChip> : <StatusChip tone="muted">Inactivo</StatusChip>}</td>
                  <td className="space-x-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => edit(p)} className="text-brand-orange hover:underline">Editar</button>
                    {p.active && <button type="button" onClick={() => void deactivate(p.id)} className="text-danger hover:underline">Desactivar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 grid gap-4 border-t border-mist/10 pt-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold text-white sm:col-span-2">{editing ? "Editar plan" : "Nuevo plan"}</h3>
        <div>
          <label htmlFor="plan-name" className="block text-sm text-white">Nombre</label>
          <input id="plan-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="plan-price" className="block text-sm text-white">Precio ({currency})</label>
          <input id="plan-price" required inputMode="decimal" placeholder="9.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="plan-desc" className="block text-sm text-white">Descripción</label>
          <input id="plan-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="plan-interval" className="block text-sm text-white">Intervalo</label>
          <select id="plan-interval" value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value as "month" | "year" })} className={`mt-1 ${inputCls}`}>
            <option value="month">Mensual</option>
            <option value="year">Anual</option>
          </select>
        </div>
        <div>
          <label htmlFor="plan-quota" className="block text-sm text-white">Creaciones por periodo</label>
          <input id="plan-quota" type="number" min={1} disabled={form.unlimited} value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} className={`mt-1 ${inputCls} disabled:opacity-40`} />
          <label className="mt-2 flex items-center gap-2 text-xs text-mist">
            <input type="checkbox" checked={form.unlimited} onChange={(e) => setForm({ ...form, unlimited: e.target.checked })} className="accent-brand-orange" />
            Ilimitado
          </label>
        </div>
        <div>
          <label htmlFor="plan-order" className="block text-sm text-white">Orden</label>
          <input id="plan-order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-white">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-brand-orange" />
          Activo (visible en /planes)
        </label>
        <div className="sm:col-span-2">
          <Feedback error={error} ok={ok} />
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Guardando…" : editing ? "Guardar plan" : "Crear plan"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyPlan); }} className={btnSecondary}>Cancelar</button>}
          </div>
          <p className="mt-2 text-xs text-muted">Al crear un plan activo o cambiar su precio, se publica en PayPal automáticamente.</p>
        </div>
      </form>
    </div>
  );
}

/* ── Paquetes de créditos ───────────────────────────────────────── */

const emptyPack = { name: "", credits: "", price: "", active: true, sortOrder: "0" };

function PacksSection({ currency }: { currency: string }) {
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [form, setForm] = useState(emptyPack);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { ok, flash } = useFlash();

  const load = useCallback(async () => {
    try {
      setPacks((await api<{ packs: Pack[] }>("/api/admin/billing/packs")).packs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const priceCents = toCents(form.price);
    const credits = Math.floor(Number(form.credits));
    if (Number.isNaN(priceCents)) return setError("Indica un precio válido, por ejemplo 4.99.");
    if (!(credits >= 1)) return setError("Indica cuántos créditos incluye el paquete.");
    setSaving(true);
    try {
      const body = JSON.stringify({ name: form.name.trim(), credits, priceCents, active: form.active, sortOrder: Math.floor(Number(form.sortOrder) || 0) });
      await api(editing ? `/api/admin/billing/packs/${editing}` : "/api/admin/billing/packs", { method: editing ? "PATCH" : "POST", body }, "No se pudo guardar el paquete.");
      setForm(emptyPack);
      setEditing(null);
      flash(editing ? "Paquete actualizado." : "Paquete creado.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    try {
      await api(`/api/admin/billing/packs/${id}`, { method: "DELETE" }, "No se pudo desactivar.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-white">Paquetes de créditos</h2>
      {packs === null ? (
        <p className="mt-4 text-sm text-muted"><Spinner /> Cargando…</p>
      ) : packs.length === 0 ? (
        <EmptyState label="Aún no hay paquetes." />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr><th className="py-2">Nombre</th><th>Créditos</th><th>Precio</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id} className="border-t border-mist/10 text-mist">
                  <td className="py-2 text-white">{p.name}</td>
                  <td>{p.credits}</td>
                  <td>{fmtMoney(p.priceCents, p.currency)}</td>
                  <td>{p.active ? <StatusChip tone="success">Activo</StatusChip> : <StatusChip tone="muted">Inactivo</StatusChip>}</td>
                  <td className="space-x-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => { setEditing(p.id); setForm({ name: p.name, credits: String(p.credits), price: (p.priceCents / 100).toFixed(2), active: p.active, sortOrder: String(p.sortOrder) }); }} className="text-brand-orange hover:underline">Editar</button>
                    {p.active && <button type="button" onClick={() => void deactivate(p.id)} className="text-danger hover:underline">Desactivar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 grid gap-4 border-t border-mist/10 pt-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold text-white sm:col-span-2">{editing ? "Editar paquete" : "Nuevo paquete"}</h3>
        <div>
          <label htmlFor="pack-name" className="block text-sm text-white">Nombre</label>
          <input id="pack-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="pack-credits" className="block text-sm text-white">Créditos</label>
          <input id="pack-credits" type="number" min={1} required value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="pack-price" className="block text-sm text-white">Precio ({currency})</label>
          <input id="pack-price" required inputMode="decimal" placeholder="4.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="pack-order" className="block text-sm text-white">Orden</label>
          <input id="pack-order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={`mt-1 ${inputCls}`} />
        </div>
        <label className="flex items-center gap-2 text-sm text-white sm:col-span-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-brand-orange" />
          Activo (visible en /planes)
        </label>
        <div className="sm:col-span-2">
          <Feedback error={error} ok={ok} />
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Guardando…" : editing ? "Guardar paquete" : "Crear paquete"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyPack); }} className={btnSecondary}>Cancelar</button>}
          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Ajuste manual de créditos ──────────────────────────────────── */

function CreditsSection() {
  const [email, setEmail] = useState("");
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { ok, flash } = useFlash();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const d = Math.trunc(Number(delta));
    if (!d) return setError("Indica una cantidad distinta de 0 (negativa para restar).");
    setSaving(true);
    try {
      const found = await api<{ items: Array<{ id: string; email: string }> }>(`/api/admin/users?q=${encodeURIComponent(email.trim())}&pageSize=5`);
      const user = found.items.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) throw new Error("No existe ningún usuario con ese correo.");
      await api("/api/admin/billing/credits", { method: "POST", body: JSON.stringify({ userId: user.id, delta: d, note: note.trim() || undefined }) }, "No se pudo ajustar.");
      flash(`Créditos ajustados (${d > 0 ? "+" : ""}${d}) para ${user.email}.`);
      setDelta("");
      setNote("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="text-sm font-semibold text-white">Ajustar créditos de un usuario</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="cr-email" className="block text-sm text-white">Correo del usuario</label>
          <input id="cr-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="cr-delta" className="block text-sm text-white">Cantidad (±)</label>
          <input id="cr-delta" type="number" required value={delta} onChange={(e) => setDelta(e.target.value)} className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="cr-note" className="block text-sm text-white">Nota</label>
          <input id="cr-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1 ${inputCls}`} />
        </div>
      </div>
      <Feedback error={error} ok={ok} />
      <button type="submit" disabled={saving} className={`mt-4 ${btnPrimary}`}>{saving ? "Ajustando…" : "Ajustar créditos"}</button>
    </form>
  );
}

/* ── Pagos ──────────────────────────────────────────────────────── */

const STATUS: Record<PaymentRow["status"], { label: string; tone: "success" | "danger" | "warning" | "muted" }> = {
  created: { label: "Pendiente", tone: "muted" },
  completed: { label: "Completado", tone: "success" },
  refunded: { label: "Reembolsado", tone: "warning" },
  failed: { label: "Fallido", tone: "danger" },
};

function PaymentsSection() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ count: number; pageSize: number; items: PaymentRow[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ count: number; pageSize: number; items: PaymentRow[] }>(`/api/admin/billing/payments?page=${page}&pageSize=20`, undefined, "No se pudieron cargar los pagos.")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [page]);

  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;
  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-white">Pagos</h2>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {!data ? (
        !error && <p className="mt-4 text-sm text-muted"><Spinner /> Cargando…</p>
      ) : data.items.length === 0 ? (
        <EmptyState label="Todavía no hay pagos." />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr><th className="py-2">Fecha</th><th>Usuario</th><th>Tipo</th><th>Importe</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-t border-mist/10 text-mist">
                    <td className="py-2">{fmtDate(p.createdAt)}</td>
                    <td className="text-white">{p.user.email}</td>
                    <td>{p.kind === "credit_pack" ? "Paquete de créditos" : "Suscripción"}</td>
                    <td>{fmtMoney(p.amountCents, p.currency)}</td>
                    <td><StatusChip tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusChip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>{data.count} pagos · página {page} de {pages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={btnSecondary}>Anterior</button>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className={btnSecondary}>Siguiente</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Página ─────────────────────────────────────────────────────── */

const TABS = [
  { id: "general", label: "General y PayPal" },
  { id: "planes", label: "Planes" },
  { id: "paquetes", label: "Paquetes" },
  { id: "creditos", label: "Créditos" },
  { id: "pagos", label: "Pagos" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminMonetizacion() {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("general");

  const load = useCallback(async () => {
    setError("");
    try {
      setSettings((await api<{ settings: BillingSettings }>("/api/admin/billing/settings", undefined, "No se pudieron cargar los ajustes de monetización.")).settings);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (error && !settings) return <ErrorBanner message={error} onRetry={() => void load()} />;
  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" aria-hidden="true" />
        Cargando monetización…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Secciones de monetización" className="flex gap-1 overflow-x-auto rounded-2xl border border-mist/10 bg-night/60 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm transition ${tab === t.id ? "bg-brand-orange/20 font-semibold text-white" : "text-muted hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!settings.enabled && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          Los cobros están desactivados: todos los usuarios crean sin límite.
        </p>
      )}
      {tab === "general" && <SettingsSection settings={settings} onSaved={setSettings} />}
      {tab === "planes" && <PlansSection currency={settings.currency} />}
      {tab === "paquetes" && <PacksSection currency={settings.currency} />}
      {tab === "creditos" && <CreditsSection />}
      {tab === "pagos" && <PaymentsSection />}
    </div>
  );
}
