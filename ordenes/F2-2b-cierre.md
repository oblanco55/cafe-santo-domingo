# ORDEN F2-2b — Cerrar F2-2 (perfil: especializado-en-inteligencia-artificial). Breve; informe máx. 8 líneas. Si falla 2 veces, DETENTE.
Contexto: ordenes/F2-2-ia-multiproveedor.md. Tu ejecución anterior se cortó (gateway desconectado). HECHOS VERIFICADOS POR CLAUDE: SIN COMMIT existen src/lib/ai/openai-compatible.ts (276 líneas), presets.ts (123), y cambios en engine.ts e index.ts; `npx tsc --noEmit` pasa. Ejecuta `git diff --stat` y `ls src/lib/ai tests/ai` primero. NO reescribas lo que existe.
FALTA (compruébalo uno por uno):
1. Punto 3 (AnthropicProvider acepta apiKey/model por constructor) y punto 6 (src/lib/ai/test-connection.ts con testProvider) si no existen.
2. Punto 7: tests Vitest en tests/ai/ (fetch mockeado con vi.stubGlobal): tool_calls; respaldo a json_object; 429 → RATE_LIMIT; cadena con respaldo (1º falla, 2º responde); resolución sin BD ni clave → mock.
3. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
4. OBLIGATORIO: git add -A (sin .env) && git commit -m "feat(F2-2): IA multi-proveedor configurable con respaldo" && git push origin main.
