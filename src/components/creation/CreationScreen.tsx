"use client";

import Link from "next/link";
import { useState, useCallback, useRef, useEffect } from "react";
import CreationForm, { type BusinessProfile } from "./CreationForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ResultView from "./ResultView";

type CreationType = "video" | "photo" | "carousel";

interface CreationScreenProps {
  type: CreationType;
  initialProfile: BusinessProfile | null;
}

const PROCESSING_STEPS = [
  "Analizando tu información",
  "Aplicando estrategia de contenido",
  "Creando guía personalizada",
  "Adaptando a tu plataforma",
];

const API_PATHS: Record<CreationType, string> = {
  video: "/api/creations/video",
  photo: "/api/creations/photo",
  carousel: "/api/creations/carousel",
};

type Substate = "form" | "processing" | "success" | "error";

export default function CreationScreen({
  type,
  initialProfile,
}: CreationScreenProps) {
  const [substate, setSubstate] = useState<Substate>("form");
  const [submitting, setSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  // F2-7d: límite gratuito agotado → ofrecer planes en vez de reintentar.
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  const startSteps = useCallback(() => {
    setStepIndex(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
    let i = 0;
    stepTimer.current = setInterval(() => {
      i = (i + 1) % PROCESSING_STEPS.length;
      setStepIndex(i);
    }, 1800);
  }, []);

  const stopSteps = useCallback(() => {
    if (stepTimer.current) {
      clearInterval(stepTimer.current);
      stepTimer.current = null;
    }
  }, []);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setFormValues(values);
      setErrorMessage("");
      setPaymentRequired(false);
      setFieldErrors({});
      setSubmitting(true);
      setSubstate("processing");
      startSteps();
      try {
        const res = await fetch(API_PATHS[type], {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        const body: unknown = await res.json().catch(() => ({}));

        if (res.ok) {
          setResult(body);
          setSubstate("success");
          setStepIndex(PROCESSING_STEPS.length);
        } else {
          const errBody = body as {
            error?: {
              code?: string;
              message?: string;
              fieldErrors?: Record<string, string | string[]>;
            };
          };
          const msg = errBody?.error?.message ?? "Ocurrió un error al generar tu contenido. Inténtalo de nuevo.";
          setErrorMessage(msg);
          setPaymentRequired(errBody?.error?.code === "PAYMENT_REQUIRED");

          if (errBody?.error?.fieldErrors) {
            const flatErrors: Record<string, string> = {};
            for (const [field, val] of Object.entries(errBody.error.fieldErrors)) {
              flatErrors[field] = Array.isArray(val) ? val[0] : String(val);
            }
            setFieldErrors(flatErrors);
          }

          stopSteps();
          setSubstate("error");
        }
      } catch {
        setErrorMessage("Error de red. Verifica tu conexión e inténtalo de nuevo.");
        stopSteps();
        setSubstate("error");
      } finally {
        setSubmitting(false);
      }
    },
    [type, startSteps, stopSteps]
  );

  const handleRetry = useCallback(() => {
    if (formValues) {
      void handleSubmit(formValues);
    }
  }, [formValues, handleSubmit]);

  // --- Processing view ---
  if (substate === "processing") {
    return (
      <Card className="w-full">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative h-16 w-16" role="status" aria-label="Procesando">
            <div className="absolute inset-0 rounded-full border-2 border-mist/20" />
            <div
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-orange"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, #FC762F 60%, transparent 61%)",
                WebkitMask: "radial-gradient(farthest-side, transparent 60%, #000 61%)",
                mask: "radial-gradient(farthest-side, transparent 60%, #000 61%)",
                backgroundClip: "padding-box",
                border: "none",
              }}
            />
          </div>

          <div className="mt-8 w-full max-w-sm space-y-3" aria-live="polite">
            {PROCESSING_STEPS.map((step, i) => {
              const isActive = i === stepIndex;
              const isDone = i < stepIndex;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-300 ${
                    isActive
                      ? "border-brand-orange/40 bg-brand-orange/10 text-white"
                      : isDone
                        ? "border-mist/10 bg-ink text-mist"
                        : "border-transparent text-muted"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isDone
                        ? "bg-success/20 text-success"
                        : isActive
                          ? "bg-brand-orange text-ink"
                          : "bg-mist/10 text-muted"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </span>
                  <span className={isActive ? "font-medium" : ""}>{step}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-muted">
            La IA está preparando tu contenido. No cierres esta pestaña.
          </p>
        </div>
      </Card>
    );
  }

  // --- Success view (T8) ---
  if (substate === "success") {
    const body = result as { output: unknown } | null;
    return (
      <ResultView
        type={type}
        output={body?.output ?? null}
        onCreateAnother={() => {
          setSubstate("form");
          setFormValues(null);
          setResult(null);
        }}
        onEdit={() => {
          setSubstate("form");
          setResult(null);
        }}
        onRegenerate={async () => {
          if (formValues) {
            await handleSubmit(formValues);
          }
        }}
        regenerating={submitting}
      />
    );
  }

  // --- Form (with error state) ---
  return (
    <div className="w-full space-y-4">
      {substate === "error" && (
        <Card className="w-full">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/20">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-danger" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M10 6v5M10 13.5v.5" strokeLinecap="round" />
                <path d="M8.5 2.5h3l7 14h-14l7-14z" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-danger">
                {paymentRequired ? "Necesitas un plan o créditos" : "Hubo un problema"}
              </h3>
              <p className="mt-1 text-sm text-mist">{errorMessage}</p>
              {Object.keys(fieldErrors).length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-danger">
                  {Object.values(fieldErrors).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              )}
              {paymentRequired ? (
                <Link
                  href="/planes"
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-orange via-brand-coral to-brand-fuchsia px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 sm:w-auto"
                >
                  Ver planes
                </Link>
              ) : (
                <Button variant="secondary" className="mt-4 w-full sm:w-auto" onClick={handleRetry}>
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <CreationForm
        type={type}
        initialProfile={initialProfile}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
