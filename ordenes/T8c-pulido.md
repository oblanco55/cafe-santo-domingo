# ORDEN T8c — Pulido (perfil: desarrollador-frontend). Breve; informe máx. 5 líneas. Si falla 2 veces, DETENTE.
Claude verificó T8 en navegador (OK). Dos detalles:
1. El selector de países está ordenado por código ISO ("Alemania" sale después de "Cuba"). Ordénalo alfabéticamente por nombre en español (localeCompare 'es') donde se renderizan las opciones (o en COUNTRIES de src/lib/contracts/catalogs.ts si así es más simple; no cambies los códigos).
2. Placeholder de la descripción dice "con al detalle": corrige a "Describe tu producto o servicio con detalle…" (y que coincida con la etiqueta dinámica producto/servicio si aplica).
3. npx tsc --noEmit ; npm test ; npm run build ; npm run test:e2e.
4. OBLIGATORIO: git add -A (sin .env) && git commit -m "fix(T8c): orden de países y texto de ayuda" && git push origin main.
