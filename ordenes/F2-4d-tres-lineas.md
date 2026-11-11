# ORDEN F2-4d — Tres correcciones exactas del panel (perfil: desarrollador-frontend). Breve; informe máx. 6 líneas. Si un paso falla 2 veces, DETENTE. NO toques ningún otro archivo ni rediseñes nada.
HECHOS VERIFICADOS POR CLAUDE en el navegador (errores reales de consola) y en el código:
1. src/components/admin/IA.tsx — error "t.map is not a function". La API devuelve objetos, no arrays:
   - línea ~67: `const pJson = (await pc.json()) as Provider[];` → `const pJson = ((await pc.json()).providers ?? []) as Provider[];`
   - línea ~76: `const psJson = (await ps.json()) as Preset[];` → `const psJson = ((await ps.json()).presets ?? []) as Preset[];`
2. Usuarios — error "Cannot read properties of undefined (reading 'creations')". GET /api/admin/users devuelve items con `nCreaciones` (número), NO `counts.creations`:
   - src/components/admin/Usuarios.tsx líneas ~242 y ~338: `u.counts.creations` → `u.nCreaciones`; en el tipo UserRow sustituye `counts: {...}` por `nCreaciones: number`.
   - src/components/admin/UsersSection.tsx línea ~417: igual.
3. src/app/admin/page.tsx — error "Cannot read properties of undefined (reading 'providers')". GET /api/admin/metrics devuelve SOLO `{ metrics: { users, creations } }` (sin `ai`). Línea ~124 `data.ai.providers === 0`: quita `ai` del tipo; cuenta los proveedores con un segundo fetch a GET /api/admin/ai/providers (respuesta `{ providers: [...] }`) y usa `providers.length === 0` para el aviso. Comprueba que el resto del componente lee `json.metrics.users.*` y `json.metrics.creations.*` (total, activos, nuevosPeriodo; total, periodo, porTipo, porPlataforma, errores, porDia).
4. Verifica: `grep -rn "counts.creations\|data.ai\|as Provider\[\]" src/components/admin src/app/admin` no debe devolver las formas antiguas. npx tsc --noEmit ; npm run lint ; npm test ; npm run build.
5. OBLIGATORIO: git add -A (sin .env) && git commit -m "fix(F2-4d): resumen, usuarios e IA del panel alineados con la API" && git push origin main.
