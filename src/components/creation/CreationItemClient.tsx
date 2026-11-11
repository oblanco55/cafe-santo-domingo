"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ResultView from "./ResultView";
import type { CreationType } from "./format";

interface ItemData {
  id: string;
  type: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  parentId: string | null;
}

interface CreationItemClientProps {
  initialItem: ItemData;
}

export default function CreationItemClient({ initialItem }: CreationItemClientProps) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [payRequired, setPayRequired] = useState(false);
  const [payMessage, setPayMessage] = useState("");
  const [error, setError] = useState("");

  const handleRegenerate = useCallback(async () => {
    if (!initialItem.id || regenerating) return;
    setRegenerating(true);
    setPayRequired(false);
    setPayMessage("");
    setError("");
    try {
      const res = await fetch(`/api/creations/item/${initialItem.id}/regenerate`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = body?.error?.message ?? "No se pudo regenerar.";
        if (res.status === 402) {
          setPayRequired(true);
          setPayMessage(msg);
        } else {
          setError(msg);
        }
        return;
      }
      const newItem: ItemData = body;
      router.push(`/creaciones/${newItem.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red al regenerar.");
    } finally {
      setRegenerating(false);
    }
  }, [initialItem.id, regenerating, router]);

  const handleDelete = useCallback(async () => {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar esta creación? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/creations/item/${initialItem.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "No se pudo eliminar.");
        return;
      }
      router.push("/creaciones");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar.");
    }
  }, [initialItem.id, router]);

  const type = (initialItem.type as CreationType) ?? "photo";

  return (
    <div className="flex flex-col gap-5">
      {payRequired && (
        <Card className="border-warning/40">
          <p className="text-sm text-warning" role="alert">{payMessage}</p>
          <Link href="/planes" className="mt-3 inline-block">
            <Button variant="primary">Ver planes</Button>
          </Link>
        </Card>
      )}

      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger" role="alert">{error}</p>
        </Card>
      )}

      {initialItem.output && (
        <ResultView
          type={type}
          output={initialItem.output}
          onCreateAnother={() => router.push("/panel")}
          onEdit={() => router.push("/crear/" + type)}
          onRegenerate={handleRegenerate}
          regenerating={regenerating}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {initialItem.parentId && (
          <Link href={`/creaciones/${initialItem.parentId}`}>
            <Button variant="secondary">Ver original</Button>
          </Link>
        )}
        <Button
          variant="secondary"
          className="border-danger/40 text-danger hover:bg-danger/10"
          onClick={handleDelete}
        >
          Eliminar
        </Button>
        <Link href="/creaciones" className="sm:ml-auto">
          <Button variant="secondary">← Volver a Mis creaciones</Button>
        </Link>
      </div>
    </div>
  );
}
