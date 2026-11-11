# ORDEN F2-5 — Textos legales públicos desde la BD (perfil: desarrollador-frontend). Breve; informe máx. 6 líneas. Si falla 2 veces, DETENTE.
HECHOS: tabla LegalDocument (slug terminos|privacidad, title, content Markdown, version, updatedAt) sembrada en F2-1; renderizado Markdown seguro instalado en F2-4; páginas actuales src/app/terminos/page.tsx y src/app/privacidad/page.tsx tienen texto fijo.
1. Crea src/components/legal/LegalPage.tsx (server): recibe slug, lee de db.legalDocument; si no existe → notFound(). Muestra SiteHeader, título, "Última actualización: {fecha es-ES} · versión {n}" y el Markdown renderizado de forma segura con estilos legibles (h2, p, listas, enlaces en brand-orange).
2. terminos/page.tsx y privacidad/page.tsx usan LegalPage; `export const dynamic = 'force-dynamic'` (o revalidate 60) para reflejar cambios del admin.
3. Elimina el aviso fijo "Texto provisional"; si el contenido contiene "provisional", el admin lo controla.
4. Test e2e: tras PUT del admin (puedes reutilizar el flujo de admin.spec.ts) /terminos muestra el nuevo título.
5. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
6. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-5): textos legales públicos editables" && git push origin main.
