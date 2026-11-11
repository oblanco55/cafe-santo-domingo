# ORDEN T4a — Proveedores de IA (perfil: especializado-en-inteligencia-artificial)
Contexto: ordenes/T4-motor-ia.md punto 1. REGLAS: breve, un archivo por llamada, no toques nada fuera de src/lib/ai y tests/ai. Si un paso falla 2 veces, DETENTE y reporta.
Decisiones ya tomadas por Claude:
- src/lib/ai/errors.ts: clase AIError extends Error { code: 'VALIDATION'|'AI_FAILED'|'RATE_LIMIT'|'CONFIG'; fieldErrors? }.
- src/lib/ai/provider.ts: interfaz AIProvider exactamente como en T4 punto 1.
- src/lib/ai/anthropic.ts: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 }); messages.create({ model, max_tokens, system, messages:[{role:'user',content:user}], tools:[{name:toolName, description:'Devuelve el resultado estructurado', input_schema: jsonSchema}], tool_choice:{type:'tool',name:toolName} }); toma el bloque type==='tool_use' y devuelve su input como data. Errores: status 429 → AIError RATE_LIMIT; otros → AI_FAILED (mensaje sin datos sensibles).
- src/lib/ai/mock.ts: MockProvider con método generate que recibe además un "hint" opcional { type, input }; construye salidas válidas deterministas por modalidad usando los valores del input (platform, aspectRatio, slideCount → n láminas con index 1..n, duration → escenas cuyo último time_range termina en la duración). Textos en español, genéricos pero coherentes con sector y descripción. Exporta también buildMockOutput(type, input).
- src/lib/ai/index.ts: getProvider(): AI_PROVIDER==='anthropic' → si falta ANTHROPIC_API_KEY lanza AIError CONFIG "Falta ANTHROPIC_API_KEY"; si no → MockProvider.
- tests/ai/mock.test.ts: buildMockOutput valida con los esquemas de src/lib/contracts para photo (1:1 y 9:16), carousel (3,5,7 con carouselOutputFor) y video (15,30,45 con videoOutputFor).
Verifica: npx tsc --noEmit ; npm run lint ; npm test. Commit "feat(T4a): proveedores de IA anthropic y mock" + push. Informe máx. 8 líneas.
