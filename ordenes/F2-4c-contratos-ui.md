# ORDEN F2-4c — Alinear el panel admin con la API (perfil: desarrollador-frontend). Breve; un archivo por llamada; informe máx. 10 líneas. Si un paso falla 2 veces, DETENTE.
HECHOS VERIFICADOS POR CLAUDE en navegador (admin local): /admin/creaciones funciona. FALLAN:
- /admin (Resumen): "Cannot read properties of undefined (reading 'new30')" — src/app/admin/page.tsx espera data.users.new30.
- /admin/ia: "t.map is not a function" — espera un array.
- /admin/legal: los editores salen vacíos.
- /admin/ajustes: muestra campos INVENTADOS (Registro abierto, Tamaño máximo de subida, Máximo de reintentos) que la API no tiene.
- /admin/usuarios: 404 (la página no existe; el componente src/components/admin/Usuarios.tsx/UsersSection.tsx sí).
FORMATOS REALES DE LA API (medidos por Claude; NO los cambies, adapta la UI):
- GET /api/admin/metrics → { metrics: { users:{total, activos, nuevosPeriodo}, creations:{total, periodo, porTipo:{video,photo,carousel}, porPlataforma:{[plataforma]:n}, errores, porDia:[{fecha,total}]} } }
- GET /api/admin/users?q=&page= → { count, page, pageSize, items:[{id,name,email,role,active,nCreaciones,createdAt}] }; PATCH /api/admin/users/[id] {role?, active?}
- GET /api/admin/legal → { documents:[{slug,title,version,updatedAt,updatedBy}] } (SIN content) ; GET /api/admin/legal/[slug] → documento con content (úsalo para cargar el editor) ; PUT /api/admin/legal/[slug] {title, content}
- GET /api/admin/ai/providers → { providers:[…] } ; GET /api/admin/ai/presets → { presets:[{id,label,kind,baseUrl,defaultModel,docsUrl}] }
- GET /api/admin/settings → { settings:{ limits:{ creationsPer10Min, freeCreationsPerMonth } } } ; PUT con el mismo formato.
Haz:
1. Resumen: lee data.metrics y muestra total, activos, nuevos (nuevosPeriodo), creaciones del periodo, errores, porTipo, porPlataforma y porDia. Quita new30/last7.
2. IA: usa data.providers y data.presets.
3. Legal: al abrir un documento, GET /api/admin/legal/[slug] para cargar title y content; guardar con PUT y refrescar la versión.
4. Ajustes: SOLO dos campos — "Creaciones por usuario cada 10 minutos" (1–200) y "Creaciones gratis al mes" (0–1000). Elimina los campos inventados.
5. Crea src/app/admin/usuarios/page.tsx usando el componente existente; verifica que la navegación enlaza a /admin/usuarios.
6. Añade tests/e2e/admin-ui.spec.ts: con un admin (ADMIN_EMAILS en el webServer de playwright.config.ts) cada página /admin, /admin/usuarios, /admin/creaciones, /admin/legal, /admin/ia, /admin/ajustes carga SIN errores de consola (page.on('pageerror') → falla) y muestra su título.
7. npx tsc --noEmit ; npm run lint ; npm test ; npm run build ; npm run test:e2e.
8. OBLIGATORIO: git add -A (sin .env) && git commit -m "fix(F2-4c): panel admin alineado con la API" && git push origin main.
