# ORDEN T9c — Correcciones detectadas en T9 (perfil: desarrollador-frontend). Breve; informe máx. 8 líneas. Si falla 2 veces, DETENTE.
HECHOS VERIFICADOS POR CLAUDE:
- Bug 1: src/components/creation/CreationForm.tsx línea ~240: `aspectOptions` tiene "1:1" escrito a mano → el botón vertical dice "Vertical Story 1:1 (1080×1920)". Existe además `aspectOptions916` (correcto) usado en otro lugar.
- Bug 2 (seguridad): src/lib/rate-limit.ts línea ~48-49 toma la PRIMERA IP de x-forwarded-for, que el cliente puede falsificar para saltarse el límite de intentos. En Railway el proxy AÑADE la IP real al FINAL de la cabecera.
1. CreationForm.tsx: deja UNA sola lista `aspectOptions` con label `${cfg.label} ${value} (${cfg.width}×${cfg.height})` y úsala en ambos sitios; borra aspectOptions916.
2. rate-limit.ts: la IP es el ÚLTIMO elemento no vacío de x-forwarded-for (split(',').map(trim).filter(Boolean).at(-1)); si no hay, x-real-ip; si no, 'unknown'. Añade comentario breve con el motivo. Test Vitest tests/api/rate-limit-key.test.ts: 'x-forwarded-for: 1.1.1.1, 9.9.9.9' → usa 9.9.9.9; sin cabecera → x-real-ip.
3. tests/e2e: haz que TODOS los specs (auth.spec.ts y crear.spec.ts incluidos) usen una IP virtual única por test mediante el mismo mecanismo que helpers.ts (p. ej. test.beforeEach → page.setExtraHTTPHeaders({'x-forwarded-for': ip única})), para que la suite completa no choque con el límite de 10 registros/10 min.
4. Ajusta validacion-foto.spec.ts para que seleccione el formato vertical por su texto real "Vertical Story 9:16" (ya no por dimensiones).
5. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e (COMPLETO: deben pasar todos, desktop y mobile; reporta el total real).
6. OBLIGATORIO: git add -A (sin .env) && git commit -m "fix(T9c): etiqueta 9:16, IP del rate limit y suite E2E estable" && git push origin main.
