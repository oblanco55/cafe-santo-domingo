# ORDEN T5b — Cierre de T5 (perfil: desarrollador-backend). Breve; informe máx. 8 líneas. Si falla 2 veces, DETENTE.
Claude verificó: src/app/api/creations/[type]/route.ts e item/[id]/route.ts existen y funcionan (tsc OK, 85 tests OK). FALTA src/app/api/profile/route.ts (tu escritura falló: write_file sin 'content'). Nada está commiteado aún.
1. Crea src/app/api/profile/route.ts: GET → { profile: BusinessProfile | null } del usuario (requireUser; 401 si no hay sesión). PUT → valida body con zod (countryIso, offerType, sector, sectorOther, description, todos opcionales, reutilizando los validadores de src/lib/contracts/inputs.ts o catalogs.ts) y hace db.businessProfile.upsert; responde { profile }. Errores con jsonError/zodValidationError.
2. tests/api/profile.test.ts (vi.mock('@/lib/session') como en creations.test.ts): 401 sin usuario; GET null al inicio; PUT válido guarda; PUT con countryIso inválido → 400. Limpia los registros creados.
3. npx tsc --noEmit ; npm run lint ; npm test ; npm run build.
4. git add -A (comprueba que .env no aparece) && git commit -m "feat(T5): API de creaciones, persistencia y perfil" && git push origin main.
