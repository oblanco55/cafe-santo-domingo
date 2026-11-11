"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Segmented from "@/components/ui/Segmented";

interface ListItem {
  id: string;
  type: string;
  title: string;
  platform: string | null;
  createdAt: string;
  parentId: string | null;
}

interface ListResponse {
  count: number;
  page: number;
  pageSize: number;
  items: ListItem[];
}

type FilterValue = "" | "video" | "photo" | "carousel";

const FILTER_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "video", label: "Video" },
  { value: "photo", label: "Fotografía" },
  { value: "carousel", label: "Carrusel" },
];

const TYPE_LABELS: Record<string, string> = {
  video: "Video",
  photo: "Fotografía",
  carousel: "Carrusel",
};

const TYPE_ICONS: Record<string, string> = {
  video: "🎬",
  photo: "📷",
  carousel: "📱",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Cancun",
    });
  } catch {
    return iso;
  }
}

interface MisCreacionesProps {
  initialItems?: ListItem[];
  initialCount?: number;
}

export default function MisCreaciones({ initialItems, initialCount }: MisCreacionesProps) {
  const [filter, setFilter] = useState<FilterValue>("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ListItem[]>(initialItems ?? []);
  const [count, setCount] = useState(initialCount ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const fetchItems = useCallback(async (f: string, p: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (f) params.set("type", f);
      const res = await fetch(`/api/creations?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "No se pudo cargar la lista.");
      }
      const data: ListResponse = await res.json();
      setItems(data.items);
      setCount(data.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado al cargar tus creaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems(filter, page);
  }, [filter, page, fetchItems]);

  function handleFilterChange(v: string) {
    setFilter(v as FilterValue);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filtro por tipo */}
      <Segmented
        name="Filtrar por tipo"
        options={FILTER_OPTIONS}
        value={filter}
        onChange={handleFilterChange}
      />

      {/* Error */}
      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger" role="alert">{error}</p>
        </Card>
      )}

      {/* Lista */}
      {!loading && !error && (
        <>
          {items.length === 0 ? (
            <Card className="text-center">
              <p className="text-4xl" aria-hidden="true">🎨</p>
              <h3 className="mt-3 text-base font-semibold text-white">
                {filter ? "No tienes creaciones de este tipo." : "Aún no tienes creaciones."}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Genera tu primera guía y aparecerá aquí.
              </p>
              <Link href="/panel" className="mt-4 inline-block">
                <Button variant="primary">Ir al panel de creación</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/creaciones/${item.id}`}
                  className="block"
                >
                  <Card
                    className="w-full transition hover:border-brand-orange/40"
                    padded={false}
                  >
                    <div className="flex items-center gap-4 px-5 py-4">
                      <span className="text-2xl" aria-hidden="true">
                        {TYPE_ICONS[item.type] ?? "📄"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-brand-orange/30 bg-brand-orange/10 px-2.5 py-0.5 text-xs font-medium text-brand-orange">
                            {TYPE_LABELS[item.type] ?? item.type}
                          </span>
                          {item.platform && (
                            <span className="text-xs text-muted">{item.platform}</span>
                          )}
                        </div>
                        <h4 className="mt-1.5 truncate text-sm font-semibold text-white">
                          {item.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <svg
                        viewBox="0 0 20 20"
                        className="h-5 w-5 shrink-0 text-muted"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Anterior
              </Button>
              <span className="text-sm text-muted">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente →
              </Button>
            </div>
          )}
        </>
      )}

      {/* Loader */}
      {loading && (
        <Card className="text-center">
          <p className="text-sm text-muted">Cargando tus creaciones…</p>
        </Card>
      )}
    </div>
  );
}
