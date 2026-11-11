# ORDEN T7b — Cierre de T7 (perfil: desarrollador-frontend). Breve; informe máx. 8 líneas. Si falla 2 veces, DETENTE.
Contexto: ordenes/T7-formularios.md. Tu ejecución anterior se cortó (gateway desconectado). YA EXISTEN y compilan: src/components/creation/CreationForm.tsx, CreationScreen.tsx, src/app/crear/[type]/page.tsx y getCreationFormProfile() en src/lib/session.ts. NO los reescribas; solo corrige si un test lo exige.
FALTA:
1. Punto 3b de T7 (src/app/page.tsx: con sesión → "Ir al panel").
2. Punto 4 de T7: tests/e2e/crear.spec.ts (carrusel 7 láminas; foto con descripción corta → botón deshabilitado).
3. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
4. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(T7): formularios contextuales por modalidad" && git push origin main.
