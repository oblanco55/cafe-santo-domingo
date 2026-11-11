"use client";

import { useState, useCallback, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { COUNTRIES, OFFER_TYPES, SECTORS } from "@/lib/contracts/catalogs";

interface ProfileData {
  countryIso: string;
  offerType: string;
  sector: string;
  sectorOther: string;
  description: string;
}

interface PerfilClientProps {
  initialProfile: ProfileData;
}

export default function PerfilClient({ initialProfile }: PerfilClientProps) {
  const [countryIso, setCountryIso] = useState(initialProfile.countryIso);
  const [offerType, setOfferType] = useState(initialProfile.offerType);
  const [sector, setSector] = useState(initialProfile.sector);
  const [sectorOther, setSectorOther] = useState(initialProfile.sectorOther);
  const [description, setDescription] = useState(initialProfile.description);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setSaved(false);
      setError("");
      setFieldErrors({});

      const payload: Record<string, unknown> = {
        countryIso: countryIso || null,
        offerType: offerType || null,
        sector: sector || null,
        sectorOther: sector === "otro" ? sectorOther || null : null,
        description: description || null,
      };

      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const errBody = body as {
            error?: {
              message?: string;
              fieldErrors?: Record<string, string | string[]>;
            };
          };
          setError(errBody?.error?.message ?? "No se pudo guardar el perfil.");
          if (errBody?.error?.fieldErrors) {
            const flat: Record<string, string> = {};
            for (const [field, val] of Object.entries(errBody.error.fieldErrors)) {
              flat[field] = Array.isArray(val) ? val[0] : String(val);
            }
            setFieldErrors(flat);
          }
          return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        setError("Error de red. Verifica tu conexión e inténtalo de nuevo.");
      } finally {
        setSaving(false);
      }
    },
    [countryIso, offerType, sector, sectorOther, description]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger" role="alert">{error}</p>
        </Card>
      )}

      {saved && (
        <Card className="border-success/40">
          <p className="text-sm text-success" role="status">
            Guardado ✓
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          showLabel
          label="País"
          htmlFor="countryIso"
          error={fieldErrors.countryIso}
        >
          <Select
            id="countryIso"
            value={countryIso}
            onChange={(e) => setCountryIso(e.target.value)}
            invalid={!!fieldErrors.countryIso}
            aria-invalid={fieldErrors.countryIso ? true : undefined}
          >
            <option value="">Selecciona tu país</option>
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          showLabel
          label="Tipo de oferta"
          htmlFor="offerType"
          error={fieldErrors.offerType}
        >
          <Select
            id="offerType"
            value={offerType}
            onChange={(e) => setOfferType(e.target.value)}
            invalid={!!fieldErrors.offerType}
            aria-invalid={fieldErrors.offerType ? true : undefined}
          >
            <option value="">Selecciona una opción</option>
            {Object.entries(OFFER_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
          showLabel
        label="Sector"
        htmlFor="sector"
        error={fieldErrors.sector}
      >
        <Select
          id="sector"
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            if (e.target.value !== "otro") {
              setSectorOther("");
            }
          }}
          invalid={!!fieldErrors.sector}
          aria-invalid={fieldErrors.sector ? true : undefined}
        >
          <option value="">Selecciona tu sector</option>
          {Object.entries(SECTORS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {sector === "otro" && (
        <Field
          showLabel
          label="Sector (otro)"
          htmlFor="sectorOther"
          error={fieldErrors.sectorOther}
          hint="Indica tu sector en al menos 2 caracteres."
        >
          <Input
            id="sectorOther"
            value={sectorOther}
            onChange={(e) => setSectorOther(e.target.value)}
            placeholder="Ej: Repostería, Fotografía de eventos…"
            maxLength={80}
            invalid={!!fieldErrors.sectorOther}
            aria-invalid={fieldErrors.sectorOther ? true : undefined}
          />
        </Field>
      )}

      <Field
          showLabel
        label="Descripción de tu producto o servicio"
        htmlFor="description"
        error={fieldErrors.description}
        hint="Mínimo 20 caracteres. Describe qué ofreces y a quién."
      >
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe tu producto o servicio…"
          rows={5}
          maxLength={1500}
          invalid={!!fieldErrors.description}
          aria-invalid={fieldErrors.description ? true : undefined}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving} loadingText="Guardando…">
          Guardar
        </Button>
        {saved && (
          <span className="text-sm text-success" role="status">
            Guardado ✓
          </span>
        )}
      </div>
    </form>
  );
}
