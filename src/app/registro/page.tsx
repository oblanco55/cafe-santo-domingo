"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import CafeSantoDomingoLogo from "@/components/ui/CafeSantoDomingoLogo";

type FieldErrors = Record<string, string>;
type ApiError = { error?: { message?: string; fieldErrors?: FieldErrors } };

export default function RegistroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setErrors((prev) => ({ ...prev, name: "El nombre es obligatorio" }));
      return;
    }
    if (!email.includes("@")) {
      setErrors((prev) => ({ ...prev, email: "Introduce un correo válido" }));
      return;
    }
    if (password.length < 8) {
      setErrors((prev) => ({ ...prev, password: "Mínimo 8 caracteres" }));
      return;
    }
    if (!acceptTerms) {
      setErrors((prev) => ({ ...prev, acceptTerms: "Debes aceptar los términos" }));
      return;
    }
    setErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password, acceptTerms }),
      });

      if (res.status === 201) {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (result?.error) {
          router.push("/login");
          return;
        }
        router.push("/panel");
        router.refresh();
        return;
      }

      const body: ApiError | null = (await res.json().catch(() => null)) ?? null;
      if (body?.error) {
        setFormError(body.error.message ?? "No se pudo completar el registro.");
        setErrors(body.error.fieldErrors ?? {});
      } else {
        setFormError("No se pudo completar el registro. Inténtalo de nuevo.");
      }
    } catch {
      setFormError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <CafeSantoDomingoLogo size="sm" />
      <Card className="mt-8 w-full max-w-md p-6 sm:p-8">
        <h1 className="text-center text-2xl font-bold tracking-widest text-white">
          Crear cuenta
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Crea tu cuenta para usar las tres modalidades.
        </p>

        {formError && (
          <div
            className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {formError}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <Field label="Nombre completo" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              invalid={Boolean(errors.name)}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Correo electrónico" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              invalid={Boolean(errors.email)}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field
            label="Contraseña"
            htmlFor="password"
            error={errors.password}
            hint="Mínimo 8 caracteres, con una letra y un número."
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              invalid={Boolean(errors.password)}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="acceptTerms"
              className="flex cursor-pointer items-start gap-3 text-sm text-mist"
            >
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-mist/40 bg-ink accent-[#FC762F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
              />
              <span>
                Acepto los{" "}
                <Link
                  href="/terminos"
                  className="text-mist underline underline-offset-2 transition hover:text-white"
                >
                  términos y condiciones
                </Link>{" "}
                y la{" "}
                <Link
                  href="/privacidad"
                  className="text-mist underline underline-offset-2 transition hover:text-white"
                >
                  política de privacidad
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="text-sm text-danger" role="alert">
                {errors.acceptTerms}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            Crear cuenta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="text-white underline underline-offset-2 transition hover:text-mist"
          >
            Inicia sesión
          </Link>
        </p>
      </Card>
    </main>
  );
}
