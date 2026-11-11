"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, ErrorBanner, LiveStatus, Spinner, StatusChip } from "./ui";

type LegalDoc = {
  slug: string;
  title: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
};

type LegalDocFull = LegalDoc & { content: string };

const SLUG_LABELS: Record<string, string> = {
  terminos: "Términos y condiciones",
  privacidad: "Política de privacidad",
};

export default function AdminLegal() {
  const [docs, setDocs] = useState<Record<string, LegalDocFull>>({});
  const [loading, setLoading] = useState(true);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      // 1) Lista de documentos (sin content)
      const res = await fetch("/api/admin/legal", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "No se pudieron cargar los textos legales."));
      }
      const json = (await res.json()) as { documents: LegalDoc[] };
      const slugs = json.documents.map((d) => d.slug);

      // 2) Cargar content de cada documento
      const fullDocs: Record<string, LegalDocFull> = {};
      for (const slug of slugs) {
        const dres = await fetch(`/api/admin/legal/${slug}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (dres.ok) {
          const dj = (await dres.json()) as { document: LegalDocFull };
          fullDocs[slug] = dj.document;
        }
      }

      setDocs(fullDocs);
      setDrafts((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const slug of Object.keys(fullDocs)) {
          if (next[slug] === undefined) {
            next[slug] = fullDocs[slug].content ?? "";
          }
        }
        return next;
      });
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

  const save = useCallback(async (slug: string) => {
    setSaveError("");
    setSavingSlug(slug);
    setSavedSlug(null);
    try {
      const res = await fetch(`/api/admin/legal/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: SLUG_LABELS[slug] ?? slug,
          content: drafts[slug] ?? "",
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(apiErrorMessage(body, "No se pudo guardar el texto legal."));
      }
      const json = (await res.json()) as { document: LegalDocFull };
      setDocs((prev) => ({ ...prev, [slug]: json.document }));
      setSavedSlug(slug);
      setTimeout(() => setSavedSlug(null), 3000);
    } catch (e) {
      setSaveError((e as Error).message);
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setSavingSlug(null);
    }
  }, [drafts]);

  // Loading
  if (loading && Object.keys(docs).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" aria-hidden="true" />
        Cargando textos legales…
      </div>
    );
  }

  const slugs = Object.keys(SLUG_LABELS);

  return (
    <div className="space-y-6">
      {error && Object.keys(docs).length === 0 && <ErrorBanner message={error} onRetry={() => void load()} />}

      <p className="text-sm text-muted">
        Los textos publicados en el sitio usan estas entradas. Los cambios se aplican
        inmediatamente al guardar.
      </p>

      {slugs.map((slug) => {
        const doc = docs[slug];
        const draft = drafts[slug] ?? "";
        const isDirty = doc && draft !== doc.content;
        const isSaving = savingSlug === slug;
        const justSaved = savedSlug === slug;

        return (
          <div key={slug} className="rounded-2xl border border-mist/10 bg-night/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">
                {SLUG_LABELS[slug]}
              </h2>
              <div className="flex items-center gap-2">
                {justSaved && (
                  <span className="text-xs text-success" role="status">✓ Guardado</span>
                )}
                {isDirty && (
                  <span className="text-xs text-warning" role="status">Sin guardar</span>
                )}
                <button
                  type="button"
                  disabled={!isDirty || isSaving}
                  onClick={() => void save(slug)}
                  className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-coral disabled:opacity-40"
                >
                  {isSaving ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Guardando…
                    </span>
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </div>

            {doc && (
              <p className="mt-1 text-xs text-muted">
                v{doc.version} · Última actualización: {new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short" }).format(new Date(doc.updatedAt))}
              </p>
            )}

            <textarea
              value={draft}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [slug]: e.target.value }))}
              rows={14}
              className="mt-4 w-full resize-y rounded-xl border border-mist/15 bg-ink p-4 font-mono text-sm text-white focus:border-brand-orange focus:outline-none"
              aria-label={`Contenido de ${SLUG_LABELS[slug]}`}
              placeholder="Escribe el texto legal aquí (markdown)…"
            />
          </div>
        );
      })}

      {saveError && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {saveError}
        </div>
      )}

      <LiveStatus text={loading ? "Cargando textos legales." : "Textos legales listos."} />
    </div>
  );
}
