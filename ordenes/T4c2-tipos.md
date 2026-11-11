# ORDEN T4c2 — Cierre de T4c (perfil: especializado-en-inteligencia-artificial). Breve; informe máx. 8 líneas. Si falla 2 veces, DETENTE.
Claude verificó: src/lib/ai/engine.ts y tests/ai/engine.test.ts existen; npm test → 72/72 OK; pero npx tsc --noEmit da 5 errores en engine.ts (líneas ~110, 120, 127, 143, 159): `unknown` no asignable a CreationInput / Record<string, unknown>. Claude borró tus archivos de sondeo (probe-*.ts/mjs).
Haz SOLO esto:
1. En engine.ts, tras validar con el esquema de entrada, usa el resultado tipado (`const input = parsed.data`) en lugar de rawInput; tipa la unión con z.infer de los 3 esquemas de entrada. No cambies la lógica ni los tests.
2. npx tsc --noEmit (0 errores) ; npm run lint ; npm test (72 OK) ; npm run build.
3. git add src/lib/ai tests/ai ordenes && git commit -m "feat(T4): motor de IA por modalidad con validación y reintento" && git push origin main.
