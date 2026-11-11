# ORDEN T2c — Corrección (perfil: arquitecto). Sé breve, informe máx. 10 líneas.
Claude verificó: npm test → 7 fallos en tests/contracts/inputs.test.ts. Causa diagnosticada:
- Fixture `base` usa objective: 'promo' (no existe; el valor válido es 'promocion').
- Fixture usa sectorOther: null y el esquema solo acepta string|undefined.
Haz exactamente esto:
1. tests/contracts/inputs.test.ts: objective: 'promocion'; quita sectorOther: null del fixture base. Elimina la variable no usada 'objective' (warning de lint en la línea ~95).
2. src/lib/contracts/inputs.ts: sectorOther debe ser .nullish() (la UI puede enviar null). Los enums (z.enum) deben tener mensaje de error en español: { error: 'Selecciona una opción válida' } (zod v4).
3. Corre npm test, npx tsc --noEmit, npm run lint y npm run build. Todo debe pasar (warnings de lint: elimínalos si están en src/lib/contracts o tests/contracts).
4. git add src/lib/contracts tests ordenes && git commit -m "feat(T2): contratos zod de entrada/salida y catálogos" && git push origin main
