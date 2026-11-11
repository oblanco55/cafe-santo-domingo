"use client";

import { useState, useCallback, useMemo, type FormEvent } from "react";
import {
  carouselInputSchema,
  photoInputSchema,
  videoInputSchema,
} from "@/lib/contracts";
import {
  ASPECT_RATIOS,
  CAROUSEL_STRUCTURES,
  COUNTRIES,
  EQUIPMENT,
  OBJECTIVES,
  OFFER_TYPES,
  PHOTO_STYLES,
  PLATFORMS,
  RESOURCES,
  SECTORS,
  SLIDE_COUNTS,
  VIDEO_DURATIONS,
} from "@/lib/contracts/catalogs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Segmented from "@/components/ui/Segmented";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

type CreationType = "video" | "photo" | "carousel";

export interface BusinessProfile {
  countryIso: string | null;
  offerType: string | null;
  sector: string | null;
  sectorOther: string | null;
  description: string | null;
}

interface CreationFormProps {
  type: CreationType;
  initialProfile: BusinessProfile | null;
  onSubmit: (values: Record<string, unknown>) => void;
  submitting: boolean;
}

interface FormState {
  countryIso: string;
  offerType: string;
  sector: string;
  sectorOther: string;
  description: string;
  platform: string;
  objective: string;
  equipment: string;
  resources: string[];
  duration: string;
  aspectRatio: string;
  photoStyle: string;
  slideCount: string;
  carouselStructure: string;
}

const MIN_DESC = 20;
const MAX_DESC = 1500;

function buildInitialState(type: CreationType, profile: BusinessProfile | null): FormState {
  return {
    countryIso: profile?.countryIso ?? "",
    offerType: profile?.offerType ?? "",
    sector: profile?.sector ?? "",
    sectorOther: profile?.sectorOther ?? "",
    description: profile?.description ?? "",
    platform: "",
    objective: "presentacion",
    equipment: "",
    resources: [],
    duration: "",
    aspectRatio: "",
    photoStyle: "ia_recomienda",
    slideCount: "",
    carouselStructure: "ia_recomienda",
  };
}

function getSchema(type: CreationType) {
  switch (type) {
    case "video": return videoInputSchema;
    case "photo": return photoInputSchema;
    case "carousel": return carouselInputSchema;
  }
}

function buildPayload(type: CreationType, state: FormState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    countryIso: state.countryIso,
    offerType: state.offerType,
    sector: state.sector,
    sectorOther: state.sector === "otro" ? state.sectorOther : undefined,
    description: state.description,
    platform: state.platform,
    objective: state.objective,
    equipment: state.equipment || undefined,
    resources: state.resources.length > 0 ? state.resources : undefined,
  };
  if (type === "video") {
    base.duration = Number(state.duration);
  } else if (type === "photo") {
    base.aspectRatio = state.aspectRatio;
    base.photoStyle = state.photoStyle;
  } else {
    base.slideCount = Number(state.slideCount);
    base.carouselStructure = state.carouselStructure;
    base.aspectRatio = state.aspectRatio;
  }
  return base;
}

function fieldErrorsFromZod(issues: Array<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path[0];
    const key = typeof path === "string" ? path : null;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

const DESCRIPTION_EXAMPLES: Record<string, { product: string; service: string }> = {
  video: {
    product: "Vendo velas aromáticas artesanales con fragancias de lavanda y vainilla. Lo que me diferencia es que son hechas en pequeños lotes de 20 unidades, con frascos de vidrio reutilizable.",
    service: "Ofrezco clases particulares de inglés conversacional online, 45 minutos por sesión. Mis alumnos destacan mi paciencia y el método basado en conversaciones reales.",
  },
  photo: {
    product: "Fabrico tazas de cerámica artesanal esmaltada a mano. Cada pieza es única y se hornea dos veces para lograr el acabado brillante que me caracteriza.",
    service: "Soy fotógrafa de eventos corporativos. Mismo día entrego las fotos editadas y mi equipo incluye fondo infinito y aros de luz.",
  },
  carousel: {
    product: "Vendo mochilas de lona resistente impermeables para estudiantes, con compartimento acolchado para laptop de hasta 16 pulgadas.",
    service: "Somos una peluquería de barrio donde también vendemos cosmética capilar ecológica. Los clientes eligen el servicio de corte y la línea de producto que más les gusta.",
  },
};

const BUTTON_LABELS: Record<CreationType, string> = {
  video: "Generar guion",
  photo: "Generar guía fotográfica",
  carousel: "Generar guía de carrusel",
};

const TITLES: Record<CreationType, { title: string; subtitle: string }> = {
  video: {
    title: "Guion de video",
    subtitle: "Cuéntanos qué quieres promocionar y la IA creará un guion por escenas adaptado a tu plataforma.",
  },
  photo: {
    title: "Fotografía estática",
    subtitle: "Describe tu producto o servicio y la IA diseñará una guía fotográfica completa para una sola imagen.",
  },
  carousel: {
    title: "Carrusel para redes sociales",
    subtitle: "Define tu idea y elige la cantidad de láminas: la IA creará una guía fotográfica por lámina con copy final.",
  },
};

export default function CreationForm({
  type,
  initialProfile,
  onSubmit,
  submitting,
}: CreationFormProps) {
  const [state, setState] = useState<FormState>(() => buildInitialState(type, initialProfile));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [submittingError, setSubmittingError] = useState("");

  const schema = useMemo(() => getSchema(type), [type]);

  const validate = useCallback((): { valid: boolean; errors: Record<string, string> } => {
    const payload = buildPayload(type, state);
    const result = schema.safeParse(payload);
    if (result.success) return { valid: true, errors: {} };
    return { valid: false, errors: fieldErrorsFromZod(result.error.issues) };
  }, [type, state, schema]);

  const { valid } = useMemo(() => validate(), [validate]);

  function updateField(field: string, value: string | string[]) {
    setState((prev) => ({ ...prev, [field]: value }));
    setSubmittingError("");
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function toggleResource(value: string, current: string[]): string[] {
    if (value === "ninguno") {
      return current.includes("ninguno") ? [] : ["ninguno"];
    }
    const withoutNinguno = current.filter((r) => r !== "ninguno");
    return withoutNinguno.includes(value)
      ? withoutNinguno.filter((r) => r !== value)
      : [...withoutNinguno, value];
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const { valid: formValid, errors: formErrors } = validate();
    setErrors(formErrors);
    if (!formValid) {
      setTouched(Object.fromEntries(Object.keys(state).map((k) => [k, true])));
      return;
    }
    setSubmittingError("");
    onSubmit(buildPayload(type, state));
  }

  const descriptionExample = DESCRIPTION_EXAMPLES[type]?.[state.offerType === "service" ? "service" : "product"] ?? "";
  const descLabel = state.offerType === "service" ? "Háblanos un poco de tu servicio" : "Háblanos un poco de tu producto";
  const equipmentLabel = type === "video" ? "¿Con qué vas a grabar?" : "¿Con qué vas a tomar las fotos?";
  const descCount = state.description.trim().length;
  const descOverLimit = descCount > MAX_DESC;

  const countryOptions = COUNTRIES.map((c) => ({ value: c.iso, label: c.name }));
  const sectorOptions = Object.entries(SECTORS).map(([value, label]) => ({ value, label }));
  const objectiveOptions = Object.entries(OBJECTIVES).map(([value, label]) => ({ value, label }));
  const equipmentOptions = Object.entries(EQUIPMENT).map(([value, label]) => ({ value, label }));
  const resourceOptions = Object.entries(RESOURCES).map(([value, label]) => ({ value, label }));
  const photoStyleOptions = Object.entries(PHOTO_STYLES).map(([value, label]) => ({ value, label }));
  const carouselStructureOptions = Object.entries(CAROUSEL_STRUCTURES).map(([value, label]) => ({ value, label }));
  const platformOptions = Object.entries(PLATFORMS).map(([value, label]) => ({ value, label }));
  const offerOptions = Object.entries(OFFER_TYPES).map(([value, label]) => ({ value, label }));
  const aspectOptions = Object.entries(ASPECT_RATIOS).map(([value, cfg]) => ({
    value,
    label: `${cfg.label} ${value} (${cfg.width}×${cfg.height})`,
  }));
  const slideCountOptions = SLIDE_COUNTS.map((n) => ({ value: String(n), label: String(n) }));
  const durationOptions = VIDEO_DURATIONS.map((n) => ({ value: String(n), label: `${n} s` }));

  const showFieldError = (field: string) => touched[field] ? errors[field] : undefined;

  return (
    <Card padded={false} className="w-full overflow-hidden">
      <div className="border-b border-mist/10 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white sm:text-xl">{TITLES[type].title}</h2>
        <p className="mt-1 text-sm text-muted">{TITLES[type].subtitle}</p>
      </div>

      <form className="space-y-6 p-5 sm:p-6" onSubmit={handleSubmit} noValidate>
        {submittingError && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {submittingError}
          </div>
        )}

        {/* Campo 1: País */}
        <Field label="¿En qué país resides?" htmlFor="countryIso" error={showFieldError("countryIso")}>
          <Select
            id="countryIso"
            name="countryIso"
            value={state.countryIso}
            invalid={Boolean(errors.countryIso)}
            onBlur={() => handleBlur("countryIso")}
            onChange={(e) => updateField("countryIso", e.target.value)}
            aria-describedby={errors.countryIso ? "countryIso-error" : undefined}
          >
            <option value="" disabled>Selecciona tu país…</option>
            {countryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </Field>

        {/* Campo 2: Tipo de oferta */}
        <Field label="¿Qué deseas promocionar?" error={showFieldError("offerType")}>
          <Segmented
            name="¿Qué deseas promocionar?"
            options={offerOptions}
            value={state.offerType}
            onChange={(v) => updateField("offerType", v)}
            invalid={Boolean(errors.offerType)}
          />
        </Field>

        {/* Campo 3: Sector */}
        <Field label="¿A qué sector pertenece?" htmlFor="sector" error={showFieldError("sector")}>
          <Select
            id="sector"
            name="sector"
            value={state.sector}
            invalid={Boolean(errors.sector)}
            onBlur={() => handleBlur("sector")}
            onChange={(e) => {
              updateField("sector", e.target.value);
              if (e.target.value !== "otro") updateField("sectorOther", "");
            }}
          >
            <option value="" disabled>Selecciona el sector…</option>
            {sectorOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </Field>

        {/* Campo 3b: Sector "otro" */}
        {state.sector === "otro" && (
          <Field
            label="Especifica tu sector"
            htmlFor="sectorOther"
            error={showFieldError("sectorOther")}
            hint="Escribe el sector específico de tu producto o servicio (mín. 2 caracteres)."
          >
            <Input
              id="sectorOther"
              name="sectorOther"
              type="text"
              value={state.sectorOther}
              invalid={Boolean(errors.sectorOther)}
              onBlur={() => handleBlur("sectorOther")}
              onChange={(e) => updateField("sectorOther", e.target.value)}
              maxLength={80}
              placeholder="Ej. Repostería, consultoría financiera…"
            />
          </Field>
        )}

        {/* Campo 4: Descripción */}
        <Field
          label={descLabel}
          htmlFor="description"
          error={showFieldError("description")}
          hint={
            descriptionExample
              ? `Ej.: ${descriptionExample}`
              : "Qué ofreces, qué lo hace especial, qué quieres destacar."
          }
        >
          <div className="relative">
            <Textarea
              id="description"
              name="description"
              value={state.description}
              invalid={Boolean(errors.description) || descOverLimit}
              onBlur={() => handleBlur("description")}
              onChange={(e) => updateField("description", e.target.value)}
              rows={5}
              placeholder={`Describe tu ${state.offerType === "service" ? "servicio" : "producto"} con detalle…`}
            />
            <span
              className={`absolute bottom-2 right-3 text-xs ${
                descOverLimit ? "text-danger" : descCount < MIN_DESC ? "text-muted" : "text-success"
              }`}
            >
              {descCount}/{MAX_DESC}
            </span>
          </div>
        </Field>

        {/* Campo 5: Plataforma */}
        <Field label="¿Para qué plataforma es la publicación?" error={showFieldError("platform")}>
          <Segmented
            name="¿Para qué plataforma es la publicación?"
            options={platformOptions}
            value={state.platform}
            onChange={(v) => updateField("platform", v)}
            invalid={Boolean(errors.platform)}
          />
        </Field>

        {/* Campos específicos */}
        {type === "video" && (
          <Field label="¿Cuánto debe durar?" error={showFieldError("duration")}>
            <Segmented
              name="¿Cuánto debe durar?"
              options={durationOptions}
              value={state.duration}
              onChange={(v) => updateField("duration", v)}
              invalid={Boolean(errors.duration)}
            />
          </Field>
        )}

        {type === "photo" && (
          <>
            <Field label="¿Qué formato necesitas?" error={showFieldError("aspectRatio")}>
              <Segmented
                name="¿Qué formato necesitas?"
                options={aspectOptions}
                value={state.aspectRatio}
                onChange={(v) => updateField("aspectRatio", v)}
                invalid={Boolean(errors.aspectRatio)}
              />
            </Field>
            <Field label="¿Qué tipo de fotografía quieres?" htmlFor="photoStyle">
              <Select
                id="photoStyle"
                name="photoStyle"
                value={state.photoStyle}
                onChange={(e) => updateField("photoStyle", e.target.value)}
              >
                {photoStyleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </Field>
          </>
        )}

        {type === "carousel" && (
          <>
            <Field label="¿Cuántas láminas deseas?" error={showFieldError("slideCount")}>
              <Segmented
                name="¿Cuántas láminas deseas?"
                options={slideCountOptions}
                value={state.slideCount}
                onChange={(v) => updateField("slideCount", v)}
                invalid={Boolean(errors.slideCount)}
              />
            </Field>
            <Field label="¿Qué estructura prefieres?" htmlFor="carouselStructure">
              <Select
                id="carouselStructure"
                name="carouselStructure"
                value={state.carouselStructure}
                onChange={(e) => updateField("carouselStructure", e.target.value)}
              >
                {carouselStructureOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="¿Qué formato necesitas?" error={showFieldError("aspectRatio")}>
              <Segmented
                name="¿Qué formato necesitas?"
                options={aspectOptions}
                value={state.aspectRatio}
                onChange={(v) => updateField("aspectRatio", v)}
                invalid={Boolean(errors.aspectRatio)}
              />
            </Field>
          </>
        )}

        {/* Sección plegable: opcional */}
        <div className="rounded-xl border border-mist/15">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-mist transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
          >
            <span>Más detalles (opcional)</span>
            <span className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          {expanded && (
            <div className="space-y-5 border-t border-mist/10 p-4">
              <Field label="¿Qué deseas destacar?" htmlFor="objective">
                <Select
                  id="objective"
                  name="objective"
                  value={state.objective}
                  onChange={(e) => updateField("objective", e.target.value)}
                >
                  {objectiveOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </Field>

              <Field label={equipmentLabel} htmlFor="equipment">
                <Select
                  id="equipment"
                  name="equipment"
                  value={state.equipment}
                  onChange={(e) => updateField("equipment", e.target.value)}
                >
                  <option value="">Preferir no decir…</option>
                  {equipmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </Field>

              <fieldset>
                <legend className="text-sm font-medium text-mist">¿Qué recursos tienes disponibles?</legend>
                <p className="mt-1 mb-3 text-xs text-muted">Selecciona una o más opciones. «Ninguno» desmarca las demás.</p>
                <div className="flex flex-col gap-2">
                  {resourceOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-mist/15 bg-ink px-3 py-2.5 text-sm text-mist transition hover:border-mist/30"
                    >
                      <input
                        type="checkbox"
                        name="resources"
                        value={opt.value}
                        checked={state.resources.includes(opt.value)}
                        onChange={() =>
                          updateField("resources", toggleResource(opt.value, state.resources))
                        }
                        className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[#FC762F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            loadingText="Procesando…"
            disabled={!valid}
            className="w-full"
          >
            {BUTTON_LABELS[type]}
          </Button>
        </div>
      </form>
    </Card>
  );
}
