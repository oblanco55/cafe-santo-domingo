import LegalPage from "@/components/legal/LegalPage";

// Refleja los cambios que haga admin en la BD sin esperar un deploy:
// la página lee LegalDocument en cada request.
export const dynamic = "force-dynamic";

export default function PrivacidadPage() {
  return <LegalPage slug="privacidad" />;
}
