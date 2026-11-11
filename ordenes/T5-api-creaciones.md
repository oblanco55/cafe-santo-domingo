# ORDEN T5 — API de creaciones y perfil (perfil: desarrollador-backend)
REGLAS: breve, un archivo por llamada. NO toques src/lib/ai, src/auth.ts, middleware ni UI. Si un paso falla 2 veces, DETENTE y reporta el error exacto.
Piezas existentes que DEBES reutilizar: requireUser() (src/lib/session.ts, lanza UnauthenticatedError), jsonError/zodValidationError (src/lib/api-errors.ts), generateCreation + AIError (src/lib/ai/engine.ts), db (src/lib/db.ts), contratos en src/lib/contracts.

1. src/app/api/creations/[type]/route.ts — POST. `type` ∈ video|photo|carousel; otro → 404 JSON {error:{code:'VALIDATION',message:'Modalidad no válida'}}.
   - user = await requireUser() (UnauthenticatedError → 401 UNAUTHORIZED).
   - body = await req.json() (JSON inválido → 400 VALIDATION).
   - try { const r = await generateCreation(type, body) } — AIError VALIDATION → 400 con fieldErrors; RATE_LIMIT → 429; CONFIG o AI_FAILED → 502 AI_FAILED con el mensaje del error. Otro error → 500 INTERNAL "Error inesperado".
   - Persistencia (doc Carrusel §9, auditoría): en éxito db.creation.create({ userId, type, input: r.input, output: r.output, status:'ok', model: r.model }); en AI_FAILED/CONFIG/RATE_LIMIT también se guarda con status:'error', output null, errorMessage. Los errores VALIDATION NO se guardan.
   - Tras éxito, upsert de BusinessProfile con countryIso, offerType, sector, sectorOther, description del input (para precargar la próxima vez).
   - Respuesta 201: { id, type, output } (CreateCreationResponse de contracts/api.ts).
   - Límite simple en memoria: 20 creaciones por usuario cada 10 min → 429 RATE_LIMIT "Has alcanzado el límite temporal. Intenta en unos minutos." (reutiliza src/lib/rate-limit.ts).
2. src/app/api/creations/[type]/[id]/route.ts NO; en su lugar src/app/api/creations/item/[id]/route.ts — GET: devuelve {id,type,input,output,status,createdAt} solo si pertenece al usuario (si no, 404).
3. src/app/api/profile/route.ts — GET: BusinessProfile del usuario o null. PUT: valida con un esquema zod parcial (countryIso, offerType, sector, sectorOther, description — reutiliza los de inputs.ts) y hace upsert.
4. Tests Vitest tests/api/creations.test.ts mockeando requireUser (vi.mock('@/lib/session')) y usando AI_PROVIDER=mock con la BD docker (limpia lo creado):
   - 401 sin usuario; 404 tipo inválido; 400 con input inválido (y NO se guarda); 201 carrusel 5 láminas → fila Creation status ok + BusinessProfile creado; generateCreation que lanza AI_FAILED (vi.spyOn) → 502 y fila con status error; GET item de otro usuario → 404.
5. npx tsc --noEmit ; npm run lint ; npm test ; npm run build.
6. git add -A (sin .env) && git commit -m "feat(T5): API de creaciones, persistencia y perfil" && git push origin main. Informe máx. 10 líneas con resultados reales.
